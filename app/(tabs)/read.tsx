import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, FlatList, Pressable, TextInput, ActivityIndicator, Alert, ViewStyle, TouchableOpacity, Modal, InteractionManager, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, ArrowLeft, Play, Pause, BookMarked, BookX, CheckCircle, RefreshCw } from 'lucide-react-native';
import { surahsData } from '@/data/surahs';
import { useProgressStore } from '@/store/progressStore';
import { useQuranStore } from '@/store/quranStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useCustomColors } from '@/utils/themeUtils';
import { useThemeColor } from '@/utils/useThemeColor';
import { Verse } from '@/types';
import type { Surah } from '@/types';
import VerseItem from '@/components/VerseItem';
import { fetchVersesBySurah } from '@/services/quranApi';
import { playAudio, pauseAudio } from '@/utils/audioUtils';
import MinimalTopStrip from '@/components/MinimalTopStrip';
import JuzMemorization from '@/components/JuzMemorization';

// Dynamic batch size based on surah length
const getDynamicBatchSize = (surahVerseCount: number, isInitial: boolean = false) => {
  if (surahVerseCount < 30) {
    return isInitial ? 5 : 5; // Small surahs: 5 verses per batch
  } else {
    return isInitial ? 10 : 10; // Large surahs: 10 verses per batch  
  }
};

// In-memory cache for verses (scoped by translation language)
const verseCache = new Map<string, Verse[]>();
const surahLoadingState = new Map<string, { currentPage: number; hasMore: boolean; totalVerses: number }>();

// Helper function to generate cache key (scoped by language)
const getCacheKey = (surahId: number, page: number, language: string) => `surah_${surahId}_${language}_page_${page}`;

// Helper function to get all cached verses for a surah for a specific language
const getCachedSurahVerses = (surahId: number, language: string): { verses: Verse[], maxPage: number } => {
  const verses: Verse[] = [];
  let maxPage = 0;
  
  // Get all cached pages for this surah
  for (const [key, cachedVerses] of verseCache.entries()) {
    if (key.startsWith(`surah_${surahId}_${language}_page_`)) {
      const parts = key.split('_');
      const pageNum = parseInt(parts[parts.length - 1]);
      maxPage = Math.max(maxPage, pageNum);
      verses.push(...cachedVerses);
    }
  }
  
  // Sort verses by verse number
  verses.sort((a, b) => a.verseNumber - b.verseNumber);
  return { verses, maxPage };
};

export default function ReadScreen() {
  const router = useRouter();
  const colors = useCustomColors();
  const { primary } = useThemeColor();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSurah, setSelectedSurah] = useState<any>(null);
  const [tab, setTab] = useState<'surah' | 'juz'>('surah');
  const [verses, setVerses] = useState<Verse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreVerses, setHasMoreVerses] = useState(true);
  const [totalVersesInSurah, setTotalVersesInSurah] = useState(0);
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [progressCount, setProgressCount] = useState(0);
  const [progressAction, setProgressAction] = useState<'mark-memorized' | 'unmark-memorized' | 'mark-revised' | 'unmark-revised' | null>(null);

  const {
    memorizedVerses,
    revisedVerses,
    setLastReadVerse, 
    markVerseAsMemorized,
    unmarkVerseAsMemorized,
    markVerseAsRevised
  } = useProgressStore();
  const { clearError, setLastViewedSurahId, getLastViewedSurahId } = useQuranStore();
  const lastViewedSurahId = useQuranStore(state => state.lastViewedSurahId);
  const { autoPlayAudio, translationLanguage, arabicFont, fontSizeArabic } = useSettingsStore();

  const surahListRef = useRef<FlatList>(null);
  
  // Helper function to get Arabic font family (same as VerseItem)
  const getArabicFontFamily = () => {
    switch (arabicFont) {
      case 'scheherazade':
        return 'Scheherazade';
      case 'scheherazade-bold':
        return 'Scheherazade-Bold';
      case 'tajweed':
        return 'Scheherazade'; // Use Scheherazade for Tajweed mode
      default:
        // For system default, provide fallback Arabic fonts that are commonly available
        return Platform.select({
          ios: 'Arial, Helvetica Neue, Helvetica', // iOS has good Arabic support with these fonts
          android: 'Roboto, Noto Sans Arabic, Arial', // Android's fonts with good Arabic support
          default: 'Arial, Helvetica, sans-serif' // Fallback for other platforms
        });
    }
  };

  // Move dynamic styles inside component
  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: '#1a1a1a',
    } as ViewStyle,
    versesContainer: {
      flex: 1,
      backgroundColor: '#1a1a1a',
    } as ViewStyle,
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center' as const,
      backgroundColor: '#1a1a1a',
    } as ViewStyle,
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center' as const,
      padding: 16,
      backgroundColor: '#1a1a1a',
    } as ViewStyle,
    surahListContent: {
      padding: 16,
      backgroundColor: '#1a1a1a',
    } as ViewStyle,
    surahCard: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      padding: 16,
      marginBottom: 12,
      borderRadius: 12,
      backgroundColor: '#333333',
      borderColor: '#555555',
      borderWidth: 1,
      shadowColor: '#ffffff',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    } as ViewStyle,
  };

  // Memoize filteredSurahs
  const filteredSurahs = useMemo(() => {
    return searchQuery.trim() === ''
      ? surahsData
      : surahsData.filter((surah: Surah) =>
          surah.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
        );
  }, [searchQuery]);

  // Memoize getSurahVerseRange
  const getSurahVerseRange = useCallback((surahObj: { id: number, versesCount: number }) => {
    let startVerseId = 0;
    for (let i = 1; i < surahObj.id; i++) {
      const prevSurah = surahsData.find(s => s.id === i);
      if (prevSurah) startVerseId += prevSurah.versesCount;
    }
    const verseIds = [];
    for (let i = 1; i <= surahObj.versesCount; i++) {
      verseIds.push(startVerseId + i);
    }
    return verseIds;
  }, []);

  // Replace the calculateSurahProgress function with the one from stats page
  const calculateSurahProgress = useCallback((surahId: number) => {
    let startVerseId = 0;
    for (let i = 1; i < surahId; i++) {
      const prevSurah = surahsData.find(s => s.id === i);
      if (prevSurah) startVerseId += prevSurah.versesCount;
    }
    const surah = surahsData.find(s => s.id === surahId);
    if (!surah) return { memorized: 0, progress: 0 };
    const startVerse = startVerseId + 1;
    const endVerse = startVerseId + surah.versesCount;
    const memorizedInSurah = memorizedVerses.filter((id: number) => id >= startVerse && id <= endVerse).length;
    const progressPercentage = (memorizedInSurah / surah.versesCount) * 100;
    return { memorized: memorizedInSurah, progress: progressPercentage };
  }, [memorizedVerses]);

  // Memoize surah status (memorized/revised)
  const surahStatus = useMemo(() => {
    if (!selectedSurah) return { isMemorized: false, isRevised: false };
    const allVerseIds = getSurahVerseRange({ id: selectedSurah.id, versesCount: selectedSurah.versesCount });
    const memorizedSet = new Set(memorizedVerses);
    const revisedSet = new Set(revisedVerses.map((v: any) => v.verseId));
    const isMemorized = allVerseIds.every((id: number) => memorizedSet.has(id));
    const isRevised = allVerseIds.every((id: number) => revisedSet.has(id));
    return { isMemorized, isRevised };
  }, [selectedSurah, memorizedVerses, revisedVerses]);

  const getProgressColor = (progress: number) => {
    if (progress === 0) return '#666666'; // Grey for not started
    if (progress === 100) return '#4CAF50'; // Green for completed
    return '#FF9800'; // Orange for in progress
  };
  
  const loadInitialVerses = useCallback(async (surah: any) => {
    setIsLoading(true);
    setLoadingError(null);
    clearError();
    setTotalVersesInSurah(surah.versesCount);
    
    try {
      console.log(`Loading initial verses for surah ${surah.id} (${surah.name})`);
      
      // Check if we have cached verses for this surah
      const cachedData = getCachedSurahVerses(surah.id, translationLanguage);
      const savedState = surahLoadingState.get(`surah_${surah.id}_${translationLanguage}`);
      
      if (cachedData.verses.length > 0) {
        // Use cached verses
        console.log(`Found ${cachedData.verses.length} cached verses for surah ${surah.id}`);
        setVerses(cachedData.verses);
        setLastReadVerse(cachedData.verses[0]);
        
        // Restore loading state
        if (savedState) {
          setCurrentPage(savedState.currentPage);
          setHasMoreVerses(savedState.hasMore);
        } else {
          setCurrentPage(cachedData.maxPage);
          setHasMoreVerses(cachedData.verses.length < surah.versesCount);
        }
      } else {
        // No cache, load from API
        setCurrentPage(1);
        setHasMoreVerses(true);
        
        const { verses: fetchedVerses, total } = await fetchVersesBySurah(
          surah.id,
          1,
          getDynamicBatchSize(surah.versesCount, true),
          translationLanguage
        );
        
        if (fetchedVerses.length > 0) {
          // Cache the fetched verses
          verseCache.set(getCacheKey(surah.id, 1, translationLanguage), fetchedVerses);
          
          setVerses(fetchedVerses);
          setLastReadVerse(fetchedVerses[0]);
          setHasMoreVerses(fetchedVerses.length < total);
          
          // Save loading state
          surahLoadingState.set(`surah_${surah.id}_${translationLanguage}`, {
            currentPage: 1,
            hasMore: fetchedVerses.length < total,
            totalVerses: total
          });
        } else {
          setLoadingError(`Failed to load verses for ${surah.name}. Please check your internet connection.`);
        }
      }
    } catch (err) {
      console.error('Failed to load verses:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setLoadingError(`Failed to load verses for ${surah.name}. ${errorMessage}`);
      setVerses([]);
    } finally {
      setIsLoading(false);
    }
  }, [clearError, setLastReadVerse, translationLanguage]);

  const loadMoreVerses = useCallback(async () => {
    if (!selectedSurah || isLoadingMore || !hasMoreVerses) return;
    
    setIsLoadingMore(true);
      const nextPage = currentPage + 1;
    
    try {
      console.log(`Loading more verses for surah ${selectedSurah.id}, page ${nextPage}`);
      
      // Check if this page is already cached
      const cacheKey = getCacheKey(selectedSurah.id, nextPage, translationLanguage);
      let fetchedVerses: Verse[] = [];
      
      if (verseCache.has(cacheKey)) {
        // Use cached verses
        fetchedVerses = verseCache.get(cacheKey)!;
        console.log(`Using cached page ${nextPage} for surah ${selectedSurah.id}`);
      } else {
        // Fetch from API
        const result = await fetchVersesBySurah(
          selectedSurah.id,
          nextPage,
          getDynamicBatchSize(selectedSurah.versesCount, false),
          translationLanguage
        );
        fetchedVerses = result.verses;
        
        // Cache the fetched verses
        if (fetchedVerses.length > 0) {
          verseCache.set(cacheKey, fetchedVerses);
        }
      }
      
      if (fetchedVerses.length > 0) {
        setVerses(prev => [...prev, ...fetchedVerses]);
        setCurrentPage(nextPage);
        const newTotal = verses.length + fetchedVerses.length;
        const stillHasMore = newTotal < totalVersesInSurah;
        setHasMoreVerses(stillHasMore);
        
        // Update loading state
        surahLoadingState.set(`surah_${selectedSurah.id}_${translationLanguage}`, {
          currentPage: nextPage,
          hasMore: stillHasMore,
          totalVerses: totalVersesInSurah
        });
      } else {
        setHasMoreVerses(false);
      }
    } catch (err) {
      console.error('Failed to load more verses:', err);
      // Don't show error for load more, just stop loading
      setHasMoreVerses(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [selectedSurah, currentPage, isLoadingMore, hasMoreVerses, verses.length, totalVersesInSurah, translationLanguage]);

  const handleSurahPress = (surah: any) => {
    // In-place navigation: select surah and load verses without leaving tab context
    setSelectedSurah(surah);
    setLastViewedSurahId(surah.id);
    loadInitialVerses(surah);
  };

  // Prevent double-tap and race conditions on back
  const isNavigatingBack = useRef(false);
  // Suppress auto-open after returning to list (so we can keep scroll position)
  const suppressNextAutoOpen = useRef(false);

  const handleBackToSurahs = useCallback(() => {
    if (isNavigatingBack.current) return; // Prevent double-tap
    isNavigatingBack.current = true;
    if (selectedSurah) {
      // Keep lastViewedSurahId so list can scroll to it, but suppress auto-open once
      suppressNextAutoOpen.current = true;
      setSelectedSurah(null);
      setVerses([]);
      setLoadingError(null);
      setCurrentPage(1);
      setHasMoreVerses(true);
      setTimeout(() => {
        isNavigatingBack.current = false;
      }, 500); // Reset after animation
    } else {
      router.back();
      setTimeout(() => {
        isNavigatingBack.current = false;
      }, 500);
    }
  }, [selectedSurah, router]);

  const isVerseMemorized = (verseId: number) => {
    return memorizedVerses.includes(verseId);
  };

  const isVerseRevised = (verseId: number) => {
    return revisedVerses.some(revised => revised.verseId === verseId);
  };

  // Handle marking all verses as memorized or unmarking them (work on ALL verses in surah)
  const handleMarkAllMemorized = async () => {
    if (!selectedSurah) return;

    const allSurahVerseIds = getSurahVerseRange(selectedSurah);
    const memorizedSet = new Set(memorizedVerses);

    const pendingUpdates: Array<() => Promise<void>> = [];

    for (let verseId of allSurahVerseIds) {
      if (surahStatus.isMemorized && memorizedSet.has(verseId)) {
        pendingUpdates.push(() => Promise.resolve(unmarkVerseAsMemorized(verseId)));
      } else if (!surahStatus.isMemorized && !memorizedSet.has(verseId)) {
        pendingUpdates.push(() => Promise.resolve(markVerseAsMemorized(verseId)));
      }
    }

    setProgressAction(surahStatus.isMemorized ? 'unmark-memorized' : 'mark-memorized');
    setProgressModalVisible(true);
    setProgressCount(0);

    const BATCH_SIZE = 10;
    const processedRef = { current: 0 };
    const lastReportedRef = { current: 0 };
    const isCancelled = { current: false };

    const processNextBatch = (index = 0) => {
      if (isCancelled.current) return;

      const batch = pendingUpdates.slice(index, index + BATCH_SIZE);

      Promise.all(
        batch.map(async (fn) => {
          try {
            await fn();
          } catch (e) {
            console.error("Verse update failed:", e);
          }
        })
      ).then(() => {
        processedRef.current += batch.length;

        if (
          processedRef.current - lastReportedRef.current >= 10 ||
          processedRef.current === pendingUpdates.length
        ) {
          lastReportedRef.current = processedRef.current;
          setProgressCount(processedRef.current);
        }

        if (index + BATCH_SIZE < pendingUpdates.length) {
          setTimeout(() => processNextBatch(index + BATCH_SIZE), 25);
        } else {
          setProgressModalVisible(false);
          setProgressAction(null);
        }
      });
    };

    await useQuranStore.getState().initializeDatabase();

    InteractionManager.runAfterInteractions(() => {
      processNextBatch();
    });
  };

  const handleMarkAllRevised = async () => {
    if (!selectedSurah) return;

    const allSurahVerseIds = getSurahVerseRange(selectedSurah);
    const revisedSet = new Set(revisedVerses.map((v) => v.verseId));

    const pendingUpdates: Array<() => Promise<void>> = [];

    for (let verseId of allSurahVerseIds) {
      if (surahStatus.isRevised && revisedSet.has(verseId)) {
        pendingUpdates.push(() => {
        useProgressStore.setState((state) => ({
            revisedVerses: state.revisedVerses.filter((rv) => rv.verseId !== verseId),
            dailyRevisedVerses: state.dailyRevisedVerses.filter((rv) => rv.verseId !== verseId),
            weeklyRevisedVerses: state.weeklyRevisedVerses.filter((rv) => rv.verseId !== verseId),
          }));
          return Promise.resolve();
        });
      } else if (!surahStatus.isRevised && !revisedSet.has(verseId)) {
        pendingUpdates.push(() => Promise.resolve(markVerseAsRevised(verseId)));
        }
      }

    setProgressAction(surahStatus.isRevised ? 'unmark-revised' : 'mark-revised');
    setProgressModalVisible(true);
    setProgressCount(0);

    const BATCH_SIZE = 10;
    const processedRef = { current: 0 };
    const lastReportedRef = { current: 0 };
    const isCancelled = { current: false };

    const processNextBatch = (index = 0) => {
      if (isCancelled.current) return;

      const batch = pendingUpdates.slice(index, index + BATCH_SIZE);

      Promise.all(
        batch.map(async (fn) => {
        try {
          await fn();
        } catch (e) {
          console.error("Verse update failed:", e);
        }
        })
      ).then(() => {
        processedRef.current += batch.length;

        if (
          processedRef.current - lastReportedRef.current >= 10 ||
          processedRef.current === pendingUpdates.length
        ) {
          lastReportedRef.current = processedRef.current;
          setProgressCount(processedRef.current);
        }

        if (index + BATCH_SIZE < pendingUpdates.length) {
          setTimeout(() => processNextBatch(index + BATCH_SIZE), 25);
      } else {
          setProgressModalVisible(false);
          setProgressAction(null);
        }
      });
    };

    InteractionManager.runAfterInteractions(() => {
      processNextBatch();
    });
  };

  const handlePlayAudio = async (verse: Verse) => {
    try {
      if (isPlayingAudio) {
        await pauseAudio();
        setIsPlayingAudio(false);
      } else {
        if (verse.audioUrl) {
          await playAudio(
            verse.audioUrl,
            autoPlayAudio ? 1 : 0,
            (status) => {
              if (status.isPlaying === false && !status.didJustFinish) {
                setIsPlayingAudio(false);
              }
            }
          );
          setIsPlayingAudio(true);
        } else {
          Alert.alert(
            "Audio Not Available",
            "Audio is not available for this verse.",
            [{ text: "OK" }]
          );
      }
      }
    } catch (error) {
      console.error('Audio playback error:', error);
      Alert.alert(
        "Playback Error",
        "Failed to play audio. Please try again.",
        [{ text: "OK" }]
      );
      setIsPlayingAudio(false);
    }
  };

  const renderVerse = ({ item: verse }: { item: Verse }) => (
    <VerseItem
      verse={verse}
      isMemorized={() => isVerseMemorized(verse.id)}
      isRevised={() => isVerseRevised(verse.id)}
      onMemorizeToggle={() => {
        if (isVerseMemorized(verse.id)) {
          unmarkVerseAsMemorized(verse.id);
        } else {
          markVerseAsMemorized(verse.id);
        }
      }}
      onRevisionToggle={() => {
        if (isVerseRevised(verse.id)) {
          // Remove from revised verses
          useProgressStore.setState((state) => ({
            revisedVerses: state.revisedVerses.filter((rv) => rv.verseId !== verse.id),
            dailyRevisedVerses: state.dailyRevisedVerses.filter((rv) => rv.verseId !== verse.id),
            weeklyRevisedVerses: state.weeklyRevisedVerses.filter((rv) => rv.verseId !== verse.id),
          }));
        } else {
          markVerseAsRevised(verse.id);
        }
      }}
      onPlayAudio={() => handlePlayAudio(verse)}
    />
  );

  const renderSurahItem = ({ item }: { item: Surah }) => {
    const surahProgress = calculateSurahProgress(item.id);
    const progressColor = getProgressColor(surahProgress.progress);
    const cachedData = getCachedSurahVerses(item.id, translationLanguage);
    const isCached = cachedData.verses.length > 0;
    const revelationDisplay = item.revelationType === 'Medinan' ? 'Madani' : 'Makki';
    
    return (
      <Pressable 
        style={[
          styles.surahCard,
          { 
            backgroundColor: '#333333',
            borderColor: '#555555',
            borderWidth: 1,
            shadowColor: '#ffffff',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }
        ]}
        onPress={() => handleSurahPress(item)}
      >
        <View style={[styles.surahNumber, { backgroundColor: primary }]}>
          <Text style={[styles.surahNumberText, { color: '#ffffff' }]}>{item.id}</Text>
        </View>
        <View style={styles.surahInfo}>
          <Text style={[styles.surahName, { color: '#ffffff' }]}>{item.name}</Text>
          <Text style={[styles.surahEnglish, { color: '#888888' }]}>{item.englishName}</Text>
                      <Text style={[styles.surahDetails, { color: '#888888' }]}>
              {item.versesCount} verses • <Text style={{ color: '#4CAF50' }}>{revelationDisplay}</Text>
            </Text>
        </View>
        <View style={[styles.progressPill, { backgroundColor: progressColor }]}>
          <Text style={styles.progressText}>
            {Math.round(surahProgress.progress)}%
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={primary} />
        <Text style={[styles.loadingMoreText, { color: '#888888' }]}>
          Loading more verses...
        </Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: '#888888' }]}>
          No verses found
        </Text>
      </View>
    );
  };

  // Themed progress modal for batch actions
  const renderProgressModal = () => (
    <Modal
      visible={progressModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}>
        <View style={{
          backgroundColor: '#232323',
          borderRadius: 16,
          padding: 32,
          alignItems: 'center',
          minWidth: 260,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}>
          <ActivityIndicator size="large" color={primary} style={{ marginBottom: 24 }} />
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
            {progressAction === 'mark-memorized' && 'Marking Memorized...'}
            {progressAction === 'unmark-memorized' && 'Unmarking Memorized...'}
            {progressAction === 'mark-revised' && 'Marking Revised...'}
            {progressAction === 'unmark-revised' && 'Unmarking Revised...'}
          </Text>
          <View style={{ width: 180, height: 8, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden', marginVertical: 16 }}>
            <View style={{
              width: `${Math.max(5, Math.round((progressCount / (selectedSurah?.versesCount || 1)) * 100))}%`,
              height: '100%',
              backgroundColor: primary,
              borderRadius: 4,
            }} />
          </View>
          <Text style={{ color: '#aaa', fontSize: 14 }}>{progressCount} / {selectedSurah?.versesCount || 0} verses</Text>
          <Text style={{ color: '#888', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
            Please wait while the update completes. Navigation is disabled during this process.
          </Text>
        </View>
      </View>
    </Modal>
  );

  // Helper function to clear verse cache for a specific surah and language
  const clearSurahCache = useCallback((surahId: number, language: string) => {
    const cacheKey = `surah_${surahId}_${language}_page_`;
    for (const [key] of verseCache.entries()) {
      if (key.startsWith(cacheKey)) {
        verseCache.delete(key);
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedSurah && surahListRef.current && lastViewedSurahId) {
      const index = filteredSurahs.findIndex(s => s.id === lastViewedSurahId);
      if (index >= 0) {
        setTimeout(() => {
          surahListRef.current?.scrollToIndex({ index, animated: true });
        }, 300);
      }
    }
  }, [selectedSurah, filteredSurahs, lastViewedSurahId]);
    
    // On mount, if lastViewedSurahId is set, open that surah directly
  useEffect(() => {
    if (lastViewedSurahId && !selectedSurah) {
      if (suppressNextAutoOpen.current) {
        // Skip one auto-open cycle after back navigation
        suppressNextAutoOpen.current = false;
        return;
      }
      const surah = surahsData.find(s => s.id === lastViewedSurahId);
      if (surah) {
        setSelectedSurah(surah);
        loadInitialVerses(surah);
      }
    }
  }, [lastViewedSurahId, selectedSurah, loadInitialVerses]);

  // Reload verses when translation language changes
  useEffect(() => {
    if (selectedSurah) {
      setVerses([]);
      setCurrentPage(1);
      setHasMoreVerses(true);
      loadInitialVerses(selectedSurah);
    }
  }, [translationLanguage]);

  // Smart re-fetch when switching to Tajweed mode
  useEffect(() => {
    if (selectedSurah && arabicFont === 'tajweed') {
      // Only re-fetch if we don't already have Tajweed text for the current verses
      const hasTajweedText = verses.length > 0 && verses.every(verse => verse.tajweedText);
      
      if (!hasTajweedText) {
        console.log('Switching to Tajweed mode - re-fetching verses with Tajweed text');
        clearSurahCache(selectedSurah.id, translationLanguage);
        setVerses([]);
        setCurrentPage(1);
        setHasMoreVerses(true);
        loadInitialVerses(selectedSurah);
      }
    }
  }, [arabicFont, selectedSurah, translationLanguage, clearSurahCache]);

  // Smart re-fetch when switching away from Tajweed mode
  useEffect(() => {
    if (selectedSurah && arabicFont !== 'tajweed') {
      // Only re-fetch if we currently have Tajweed text but need regular Arabic
      const hasTajweedText = verses.length > 0 && verses.some(verse => verse.tajweedText);
      
      if (hasTajweedText) {
        console.log('Switching away from Tajweed mode - re-fetching verses with regular Arabic text');
        clearSurahCache(selectedSurah.id, translationLanguage);
        setVerses([]);
        setCurrentPage(1);
        setHasMoreVerses(true);
        loadInitialVerses(selectedSurah);
      }
    }
  }, [arabicFont, selectedSurah, translationLanguage, clearSurahCache]);

  // Clear cache when arabicFont changes (for any font change)
  useEffect(() => {
    if (selectedSurah) {
      // Clear cache to ensure fresh data with new font settings
      clearSurahCache(selectedSurah.id, translationLanguage);
    } else {
      // If no surah is selected, clear all caches for the current language
      // This ensures that when user opens a surah later, they get fresh data
      for (const [key] of verseCache.entries()) {
        if (key.includes(`_${translationLanguage}_`)) {
          verseCache.delete(key);
        }
      }
    }
  }, [arabicFont, selectedSurah, translationLanguage, clearSurahCache]);

  return (
    <View style={[styles.container, { backgroundColor: '#1a1a1a' }]}> 
      {renderProgressModal()}
      {/* Header with Search */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={handleBackToSurahs} style={{ marginRight: 12 }}>
            <ArrowLeft size={28} color="#FFD700" />
          </TouchableOpacity>
          {selectedSurah ? (
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>{selectedSurah.englishName}</Text>
              <Text style={[styles.headerSubtitle, { 
                fontFamily: getArabicFontFamily(),
                fontSize: fontSizeArabic * 0.9, // Slightly smaller than verse text
                lineHeight: fontSizeArabic * 1.4
              }]}>{selectedSurah.arabicName}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                <Text style={{
                  color: '#ffffff',
                  backgroundColor: '#444',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  overflow: 'hidden',
                  marginRight: 8,
                  fontSize: 12,
                }}>
                  {(selectedSurah.revelationType === 'Medinan' ? 'Madani' : 'Makki')}
                </Text>
                <Text style={{ color: '#888888', fontSize: 12 }}>
                  {selectedSurah.versesCount} verses
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Recite Qur'an in measured and rhythmic tone!</Text>
            </View>
          )}
        </View>
        {selectedSurah && (
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={[styles.actionButton, surahStatus.isMemorized ? styles.actionButtonActive : null]} 
              onPress={handleMarkAllMemorized}
            >
              <CheckCircle size={20} color={surahStatus.isMemorized ? "#ffffff" : "#888888"} />
              <Text
                style={[
                  styles.actionButtonText,
                  surahStatus.isMemorized ? styles.actionButtonTextActive : null
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {surahStatus.isMemorized ? 'Unmark ❌' : 'Mark Memorized'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, surahStatus.isRevised ? styles.actionButtonRevised : null]} 
              onPress={handleMarkAllRevised}
            >
              <RefreshCw size={20} color={surahStatus.isRevised ? "#ffffff" : "#888888"} />
              <Text
                style={[
                  styles.actionButtonText,
                  surahStatus.isRevised ? styles.actionButtonTextActive : null
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {surahStatus.isRevised ? 'Unmark ❌' : 'Mark Revision'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        </View>

      {/* Tabs + Search - Always visible, no jumping */}
      {!selectedSurah && (
        <View style={[styles.searchBarContainer, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}> 
          {/* Tab buttons - Compact fixed width to keep search visible */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => setTab('surah')} style={[styles.tabButton, { width: 72, alignItems: 'center' }, tab === 'surah' && { backgroundColor: primary }]}> 
              <Text style={[styles.tabText, tab === 'surah' && styles.tabTextActive]}>Surah</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTab('juz')} style={[styles.tabButton, { width: 72, alignItems: 'center' }, tab === 'juz' && { backgroundColor: primary }]}> 
              <Text style={[styles.tabText, tab === 'juz' && styles.tabTextActive]}>Juz</Text>
            </TouchableOpacity>
          </View>
          
          {/* Search Bar - Right aligned, compact width */}
          <View style={[styles.searchInputWrapper, { width: 160 }]}> 
            <Search size={20} color="#888888" style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: '#ffffff' }]}
              placeholder={'Search'}
              placeholderTextColor="#888888"
              value={searchQuery}
              onChangeText={tab === 'surah' ? setSearchQuery : undefined}
              editable={tab === 'surah'}
            />
          </View>
        </View>
      )}
      
      {/* Content */}
      <View style={[styles.container, { backgroundColor: '#1a1a1a' }]}>
        {selectedSurah ? (
          // Show verses for selected surah
          <View style={[styles.versesContainer, { backgroundColor: '#1a1a1a' }]}>
            {isLoading ? (
              <View style={[styles.loadingContainer, { backgroundColor: '#1a1a1a' }]}>
                <ActivityIndicator size="large" color={primary} />
                <Text style={[styles.loadingText, { color: '#ffffff' }]}>Loading verses...</Text>
      </View>
            ) : loadingError ? (
              <View style={[styles.errorContainer, { backgroundColor: '#1a1a1a' }]}>
                <Text style={[styles.errorText, { color: '#ff5252' }]}>{loadingError}</Text>
                <Pressable 
                  style={[styles.retryButton, { backgroundColor: primary }]} 
                  onPress={() => loadInitialVerses(selectedSurah)}
                >
                  <Text style={[styles.retryButtonText, { color: '#ffffff' }]}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                data={verses}
                renderItem={renderVerse}
                keyExtractor={(item) => `${selectedSurah.id}-${item.id}`}
                contentContainerStyle={[styles.versesContent, { backgroundColor: '#1a1a1a' }]}
                onEndReached={loadMoreVerses}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={renderEmpty}
                showsVerticalScrollIndicator={true}
                removeClippedSubviews={true}
                maxToRenderPerBatch={3}
                windowSize={8}
                initialNumToRender={getDynamicBatchSize(selectedSurah.versesCount, true)}
                style={{ backgroundColor: '#1a1a1a' }}
              />
            )}
          </View>
        ) : (
          tab === 'surah' ? (
            <FlatList
              ref={surahListRef}
              data={filteredSurahs}
              renderItem={renderSurahItem}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={[styles.surahListContent, { backgroundColor: '#1a1a1a' }]}
              style={{ backgroundColor: '#1a1a1a' }}
              getItemLayout={(_data, index) => ({ length: 76, offset: 76 * index, index })}
              onScrollToIndexFailed={({ index }) => {
                setTimeout(() => { surahListRef.current?.scrollToIndex({ index, animated: true }); }, 500);
              }}
            />
          ) : (
            <JuzMemorization />
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  headerContainer: {
    paddingTop: 44,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#888888',
    marginTop: 2,
  },
  headerTagline: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    marginLeft: 16,
    marginTop: 8,
    textAlign: 'left',
    lineHeight: 28,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333333',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  actionButtonActive: {
    backgroundColor: '#4CAF50',
  },
  actionButtonRevised: {
    backgroundColor: '#FF9800', // Orange color for revised
  },
  actionButtonText: {
    color: '#888888',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtonTextActive: {
    color: '#ffffff',
  },
  backButton: {
    marginRight: 12,
    marginTop: 2,
  },
  versesContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  versesContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1a',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  surahListContent: {
    padding: 16,
    backgroundColor: '#1a1a1a',
  },
  surahCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#333333',
    borderColor: '#555555',
    borderWidth: 1,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  surahNumber: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  surahNumberText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  surahInfo: {
    flex: 1,
    marginLeft: 12,
  },
  surahName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  surahEnglish: {
    fontSize: 14,
    marginTop: 2,
    color: '#888888',
  },
  surahDetails: {
    fontSize: 12,
    marginTop: 2,
    color: '#888888',
  },
  progressPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingMoreText: {
    marginTop: 8,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
  },
  searchBarContainer: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: '#1a1a1a',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333333',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    color: '#ffffff',
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#333333',
  },
  tabActive: {
    backgroundColor: '#4b4b4b',
  },
  tabText: {
    color: '#888888',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
  },
});