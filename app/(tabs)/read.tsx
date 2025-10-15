import JuzMemorization from '@/components/JuzMemorization';
import VerseItem from '@/components/VerseItem';
import { surahsData } from '@/data/surahs';
import { fetchVersesBySurah } from '@/services/quranApi';
import { useProgressStore } from '@/store/progressStore';
import { useQuranStore } from '@/store/quranStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { Surah } from '@/types';
import { Verse } from '@/types';
import { pauseAudio, pauseSurahAudio, playAudio, playSurahAudioWithFallback, resumeSurahAudio } from '@/utils/audioUtils';
import { getArabicTypographySizing } from '@/utils/fontUtils';
import { useCustomColors } from '@/utils/themeUtils';
import { useThemeColor } from '@/utils/useThemeColor';
import { getAverageVerseHeight } from '@/utils/verseLayoutUtils';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle, Pause, Play, RefreshCw, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View, ViewStyle } from 'react-native';

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

// LRU helpers to cap cache size and avoid unbounded growth
const MAX_CACHE_SIZE = 50; // limit to ~50 pages
const cacheAccessOrder: string[] = [];
const touchCacheKey = (key: string) => {
  const idx = cacheAccessOrder.indexOf(key);
  if (idx !== -1) cacheAccessOrder.splice(idx, 1);
  cacheAccessOrder.push(key);
};
const setCacheWithLimit = (key: string, data: Verse[]) => {
  if (!verseCache.has(key) && verseCache.size >= MAX_CACHE_SIZE) {
    const oldest = cacheAccessOrder.shift();
    if (oldest) verseCache.delete(oldest);
  }
  verseCache.set(key, data);
  touchCacheKey(key);
};
const removeKeyFromOrder = (key: string) => {
  const idx = cacheAccessOrder.indexOf(key);
  if (idx !== -1) cacheAccessOrder.splice(idx, 1);
};

// Loading locks to dedupe concurrent loads per surah-language key
const loadingLocks = new Map<string, Promise<any>>();

// Helper function to generate cache key (scoped by language)
const getCacheKey = (surahId: number, page: number, language: string) => `surah_${surahId}_${language}_page_${page}`;

// Helper function to get all cached verses for a surah for a specific language
const getCachedSurahVerses = (surahId: number, language: string): { verses: Verse[], maxPage: number } => {
  const versesMap = new Map<number, Verse>(); // Use Map to prevent duplicates by verse ID
  let maxPage = 0;
  
  // Get all cached pages for this surah
  for (const [key, cachedVerses] of verseCache.entries()) {
    if (key.startsWith(`surah_${surahId}_${language}_page_`)) {
      const parts = key.split('_');
      const pageNum = parseInt(parts[parts.length - 1]);
      maxPage = Math.max(maxPage, pageNum);
      
      // Add verses to map to prevent duplicates
      cachedVerses.forEach(verse => {
        versesMap.set(verse.id, verse);
      });
    }
  }
  
  // Convert map to array and sort by verse number
  const verses = Array.from(versesMap.values()).sort((a, b) => a.verseNumber - b.verseNumber);
  return { verses, maxPage };
};

export default function ReadScreen() {
  const router = useRouter();
  const { surahId: paramSurahId, verseId: paramVerseId } = useLocalSearchParams<{ surahId?: string; verseId?: string }>();
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
  const [isPlayingSurah, setIsPlayingSurah] = useState(false);
  const [isSurahPaused, setIsSurahPaused] = useState(false);
  const surahAudioUrlRef = useRef<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreVerses, setHasMoreVerses] = useState(true);
  const [totalVersesInSurah, setTotalVersesInSurah] = useState(0);
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [progressCount, setProgressCount] = useState(0);
  const [progressAction, setProgressAction] = useState<'mark-memorized' | 'unmark-memorized' | 'mark-revised' | 'unmark-revised' | null>(null);
  
  // Scroll position restoration without triggering re-renders
  const scrollOffsetRef = useRef(0);

  const {
    memorizedVerses,
    revisedVerses,
    setLastReadVerse, 
    markVerseAsMemorized,
    unmarkVerseAsMemorized,
    markVerseAsRevised,
    unmarkVerseAsRevised,
    bulkMarkVersesMemorized,
    bulkMarkVersesRevised,
    // New: use memorizedVerseDates for khatam date
    memorizedVerseDates,
  } = useProgressStore();
  const { clearError, setLastViewedSurahId, getLastViewedSurahId } = useQuranStore();
  const lastViewedSurahId = useQuranStore(state => state.lastViewedSurahId);
  const { autoPlayAudio, translationLanguage, arabicFont, fontSizeArabic, showTranslation, fontSizeTranslation } = useSettingsStore();

  // Header Arabic text typography (smaller size for surah names)
  const headerArabicTypography = getArabicTypographySizing(fontSizeArabic * 0.9, arabicFont as any);

  // Memoize getSurahVerseRange (must be declared before usage in hooks below)
  const getSurahVerseRange = useCallback((surahObj: { id: number, versesCount: number }) => {
    let startVerseId = 0;
    for (let i = 1; i < surahObj.id; i++) {
      const prevSurah = surahsData.find(s => s.id === i);
      if (prevSurah) startVerseId += prevSurah.versesCount;
    }
    const verseIds: number[] = [];
    for (let i = 1; i <= surahObj.versesCount; i++) {
      verseIds.push(startVerseId + i);
    }
    return verseIds;
  }, []);

  // ✅ OPTIMIZED: Stable callback references
  const isVerseMemorizedCallback = useCallback((verseId: number) => {
    return memorizedVerses.includes(verseId);
  }, [memorizedVerses]);

  const isVerseRevisedCallback = useCallback((verseId: number) => {
    return revisedVerses.some(revised => revised.verseId === verseId);
  }, [revisedVerses]);

  const handleVerseMemorizeToggle = useCallback((verseId: number) => {
    if (memorizedVerses.includes(verseId)) {
      unmarkVerseAsMemorized(verseId);
    } else {
      markVerseAsMemorized(verseId);
    }
  }, [memorizedVerses, unmarkVerseAsMemorized, markVerseAsMemorized]);

  const handleVerseRevisionToggle = useCallback((verseId: number) => {
    const isRevised = revisedVerses.some(rv => rv.verseId === verseId);
    if (isRevised) {
      unmarkVerseAsRevised(verseId);
    } else {
      markVerseAsRevised(verseId);
    }
  }, [revisedVerses, markVerseAsRevised, unmarkVerseAsRevised]);

  // Memoize getSurahVerseRange must be above usage; already declared above
  // Surah-level state checking
  const isSurahMemorizedGlobally = useMemo(() => {
    if (!selectedSurah) return false;
    const allIds = getSurahVerseRange({ id: selectedSurah.id, versesCount: selectedSurah.versesCount });
    return allIds.length > 0 && allIds.every(id => memorizedVerses.includes(id));
  }, [selectedSurah, memorizedVerses, getSurahVerseRange]);

  const isSurahRevisedGlobally = useMemo(() => {
    if (!selectedSurah) return false;
    const allIds = getSurahVerseRange({ id: selectedSurah.id, versesCount: selectedSurah.versesCount });
    return allIds.length > 0 && allIds.every(id => revisedVerses.some(rv => rv.verseId === id));
  }, [selectedSurah, revisedVerses, getSurahVerseRange]);

  // Surah-level toggle handlers
  const handleSurahMemorizeToggle = useCallback(async () => {
    if (!selectedSurah) return;
    const surahVerseIds = getSurahVerseRange({ id: selectedSurah.id, versesCount: selectedSurah.versesCount });
    const isCurrentlyMemorized = isSurahMemorizedGlobally;
    try {
      if (isCurrentlyMemorized) {
        // Unmark all (override any individual marks)
        await bulkMarkVersesMemorized(surahVerseIds, false);
        // Guard: ensure store state cleared for all IDs
        surahVerseIds.forEach(id => {
          if (memorizedVerses.includes(id)) {
            unmarkVerseAsMemorized(id);
          }
        });
      } else {
        await bulkMarkVersesMemorized(surahVerseIds, true);
      }
    } catch (error) {
      console.error('Failed to toggle surah memorization:', error);
      Alert.alert('Error', 'Failed to update memorization status. Please try again.');
    }
  }, [selectedSurah, isSurahMemorizedGlobally, bulkMarkVersesMemorized, getSurahVerseRange, memorizedVerses, unmarkVerseAsMemorized]);

  const handleSurahRevisionToggle = useCallback(async () => {
    if (!selectedSurah) return;
    const surahVerseIds = getSurahVerseRange({ id: selectedSurah.id, versesCount: selectedSurah.versesCount });
    const isCurrentlyRevised = isSurahRevisedGlobally;
    try {
      if (isCurrentlyRevised) {
        // Unmark all verses as revised using individual calls
        surahVerseIds.forEach(verseId => {
          unmarkVerseAsRevised(verseId);
        });
      } else {
        // Mark all verses as revised
        await bulkMarkVersesRevised(surahVerseIds);
      }
    } catch (error) {
      console.error('Failed to toggle surah revision:', error);
      Alert.alert('Error', 'Failed to update revision status. Please try again.');
    }
  }, [selectedSurah, isSurahRevisedGlobally, bulkMarkVersesRevised, unmarkVerseAsRevised, getSurahVerseRange]);

  const handleVersePlayAudio = useCallback(async (verse: Verse) => {
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
  }, [isPlayingAudio, autoPlayAudio]);

  // Use centralized font util
  const getArabicFontFamily = () => {
    switch (arabicFont) {
      case 'uthman-taha':
        return 'UthmanTaha-Ver10';
      case 'amiri-quran':
        return 'AmiriQuran-Regular';
      case 'scheherazade':
        return 'ScheherazadeNew-Regular';
      case 'scheherazade-bold':
        return 'ScheherazadeNew-Bold';
      case 'tajweed':
        return 'ScheherazadeNew-Regular';
      case 'indo-pak':
        return 'NooreHuda-Regular';
      default:
        return 'UthmanTaha-Ver10';
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

  

  // ✅ OPTIMIZED: Memoized renderVerse with stable props (used in FlatList at line 1155)
  const renderVerseOptimized = useCallback(({ item: verse }: { item: Verse }) => (
    <VerseItem
      verse={verse}
      onPlayAudio={handleVersePlayAudio}
      surahMemorizedGlobally={isSurahMemorizedGlobally}
      surahRevisedGlobally={isSurahRevisedGlobally}
      onSurahMemorizeToggle={handleSurahMemorizeToggle}
      onSurahRevisionToggle={handleSurahRevisionToggle}
    />
  ), [handleVersePlayAudio, isSurahMemorizedGlobally, isSurahRevisedGlobally, handleSurahMemorizeToggle, handleSurahRevisionToggle]);
  const surahListRef = useRef<FlatList>(null);
  const versesListRef = useRef<FlatList<Verse>>(null);
  // Keep a mutable ref copy of verses so async loops can access the latest array
  const versesRef = useRef<Verse[]>([]);
  const targetVerseRef = useRef<number | null>(null);

  // Helper: safe scrolling to a verse index with validation and fallback
  const scrollToVerseIndex = (targetIdx: number) => {
    if (!versesListRef.current) {
      console.warn('[read] scrollToVerseIndex: versesListRef not ready');
      return;
    }
    const list = versesRef.current;
    if (!list || list.length === 0) {
      console.warn('[read] scrollToVerseIndex: verses empty');
      return;
    }
    if (targetIdx < 0 || targetIdx >= list.length) {
      console.warn('[read] scrollToVerseIndex: index out of range', { targetIdx, length: list.length });
      return;
    }

    // Delay slightly to allow render to settle
    setTimeout(() => {
      try {
        versesListRef.current?.scrollToIndex({ index: targetIdx, animated: true, viewPosition: 0.5 });
      } catch (err) {
        console.warn('[read] scrollToIndex failed, falling back to offset', err);
        const estimatedOffset = Math.max(0, Math.round(targetIdx * (averageVerseHeight || 200)));
        try {
          versesListRef.current?.scrollToOffset({ offset: estimatedOffset, animated: true });
        } catch (e) {
          console.warn('[read] scrollToOffset fallback failed', e);
        }
      }
    }, 250);
  };

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

  // Average verse height (sample-based) for virtualization
  const averageVerseHeight = useMemo(() => {
    return getAverageVerseHeight(
      verses,
      {
        arabicFontSize: fontSizeArabic,
        showTranslation: showTranslation,
        translationFontSize: fontSizeTranslation,
      }
    );
  }, [verses, fontSizeArabic, showTranslation, fontSizeTranslation]);
  
  const loadInitialVerses = useCallback(async (surah: any) => {
    const lockKey = `surah_${surah.id}_${translationLanguage}`;
    if (loadingLocks.has(lockKey)) return loadingLocks.get(lockKey);

    const loadPromise = (async () => {
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
            // Cache the fetched verses with LRU
            setCacheWithLimit(getCacheKey(surah.id, 1, translationLanguage), fetchedVerses);
            
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
    })();

    loadingLocks.set(lockKey, loadPromise);
    try { await loadPromise; } finally { loadingLocks.delete(lockKey); }
    return loadPromise;
  }, [clearError, setLastReadVerse, translationLanguage]);

  const loadMoreVerses = useCallback(async (): Promise<Verse[]> => {
    if (!selectedSurah || isLoadingMore || !hasMoreVerses) return versesRef.current || [];

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
        // touch for LRU
        (function() { const idx = cacheAccessOrder.indexOf(cacheKey); if (idx !== -1) { cacheAccessOrder.splice(idx,1); cacheAccessOrder.push(cacheKey); } })();
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
          setCacheWithLimit(cacheKey, fetchedVerses);
        }
      }

      if (fetchedVerses.length > 0) {
        let updatedVerses: Verse[] = [];
        // Use functional setState but also synchronously update versesRef inside that callback
        setVerses(prev => {
          const existingIds = new Set(prev.map(v => v.id));
          const newVerses = fetchedVerses.filter(v => !existingIds.has(v.id));
          updatedVerses = [...prev, ...newVerses];
          // Keep versesRef in sync immediately so callers can rely on it
          versesRef.current = updatedVerses;
          return updatedVerses;
        });

        setCurrentPage(nextPage);
        const newTotal = (versesRef.current?.length || 0);
        const stillHasMore = newTotal < totalVersesInSurah;
        setHasMoreVerses(stillHasMore);

        // Update loading state
        surahLoadingState.set(`surah_${selectedSurah.id}_${translationLanguage}`, {
          currentPage: nextPage,
          hasMore: stillHasMore,
          totalVerses: totalVersesInSurah
        });

        return updatedVerses;
      } else {
        setHasMoreVerses(false);
        return versesRef.current || [];
      }
    } catch (err) {
      console.error('Failed to load more verses:', err);
      // Don't show error for load more, just stop loading
      setHasMoreVerses(false);
      return versesRef.current || [];
    } finally {
      setIsLoadingMore(false);
    }
  }, [selectedSurah, currentPage, isLoadingMore, hasMoreVerses, totalVersesInSurah, translationLanguage]);

  const handleSurahPress = (surah: any) => {
    // Save current scroll position before navigating
    surahListRef.current?.getScrollableNode?.()?.scrollTop && 
      (scrollOffsetRef.current = surahListRef.current.getScrollableNode().scrollTop || 0);
    
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

    try {
      // If this screen was opened via route params (e.g. from Bookmarks using router.push with surahId),
      // handle three cases to avoid the double-back issue:
      // 1) paramSurahId exists AND a surah is currently selected -> clear the selected surah first (show surah list)
      // 2) paramSurahId exists AND no surah is selected -> call router.back() (return to originating screen)
      // 3) no paramSurahId -> fallthrough to regular behavior
      if (paramSurahId) {
        if (selectedSurah) {
          // Clear the selected surah first so the first Back shows the surah list instead of immediately exiting
          suppressNextAutoOpen.current = true;
          setSelectedSurah(null);
          setVerses([]);
          setLoadingError(null);
          setCurrentPage(1);
          setHasMoreVerses(true);
          // Clear route params so effects don't reopen the surah immediately
          try { router.replace('/(tabs)/read'); } catch {}

          // Ensure suppression only lasts briefly (avoid reopening from stale params or focus effects)
          setTimeout(() => { suppressNextAutoOpen.current = false; }, 700);

          // Restore exact scroll position (no animation)
          setTimeout(() => {
            if (surahListRef.current) {
              surahListRef.current.scrollToOffset({ offset: scrollOffsetRef.current || 0, animated: false });
            }
            isNavigatingBack.current = false;
          }, 50);
          return;
        } else {
          // No surah is selected but params exist -> user likely came from another screen (e.g. Bookmarks)
          // Go back to the previous screen
          try { router.back(); } catch { try { router.replace('/'); } catch {} }
          setTimeout(() => { isNavigatingBack.current = false; }, 500);
          return;
        }
      }

      if (selectedSurah) {
        // Close the selected surah in-place and restore list scroll position
        suppressNextAutoOpen.current = true;
        setSelectedSurah(null);
        setVerses([]);
        setLoadingError(null);
        setCurrentPage(1);
        setHasMoreVerses(true);
        // Clear route params so effects don't reopen the surah immediately
        try { router.replace('/(tabs)/read'); } catch {}

        // Restore exact scroll position (no animation)
        setTimeout(() => {
          if (surahListRef.current) {
            surahListRef.current.scrollToOffset({ offset: scrollOffsetRef.current || 0, animated: false });
          }
          isNavigatingBack.current = false;
        }, 50);
      } else {
        // When on the surah list (no selectedSurah), Back should always go to Home
        try {
          router.replace('/');
        } catch {
          router.push('/');
        }
        setTimeout(() => { isNavigatingBack.current = false; }, 300);
      }
    } catch (e) {
      console.error('[read] handleBackToSurahs error', e);
      isNavigatingBack.current = false;
    }
  }, [selectedSurah, router, paramSurahId]);

  // Handle marking all verses as memorized or unmarking them (work on ALL verses in surah)
  const BULK_UPDATE_THRESHOLD = 10; // Reduced: use bulk DB/state update for surahs with 10+ verses (was 30)

  const handleMarkAllMemorized = async () => {
    if (!selectedSurah) return;

    const allSurahVerseIds = getSurahVerseRange(selectedSurah);
    const memorizedSet = new Set(memorizedVerses);
    const isMarking = !surahStatus.isMemorized;

    // Determine which verses need updating
    const versesToUpdate = allSurahVerseIds.filter(verseId => {
      if (isMarking) {
        return !memorizedSet.has(verseId); // Only unmemorized verses
      } else {
        return memorizedSet.has(verseId); // Only memorized verses
      }
    });

    if (versesToUpdate.length === 0) {
      Alert.alert('No Changes', 'All verses are already in the desired state.');
      return;
    }

    // Show progress modal
    setProgressAction(isMarking ? 'mark-memorized' : 'unmark-memorized');
    setProgressModalVisible(true);
    setProgressCount(0);

    try {
      const startTime = Date.now(); // Performance tracking
      
      // Use bulk update for larger surahs
      if (selectedSurah.versesCount >= BULK_UPDATE_THRESHOLD) {
        console.log(`Using bulk update for ${selectedSurah.name} (${versesToUpdate.length} verses)`);
        
        // Import the database function
        const { bulkMarkVersesMemorized } = await import('@/database/QuranDatabase');
        
        // Perform bulk update
        await bulkMarkVersesMemorized(versesToUpdate, isMarking);
        
        // Update local state in batches to show progress
        const BATCH_SIZE = 50;
        for (let i = 0; i < versesToUpdate.length; i += BATCH_SIZE) {
          const batch = versesToUpdate.slice(i, i + BATCH_SIZE);
          
          if (isMarking) {
            useProgressStore.setState(state => {
              // Ensure we don't duplicate verses
              const existingSet = new Set(state.memorizedVerses);
              const newVerses = batch.filter(id => !existingSet.has(id));
              return {
                memorizedVerses: [...state.memorizedVerses, ...newVerses]
              };
            });
          } else {
            useProgressStore.setState(state => ({
              memorizedVerses: state.memorizedVerses.filter(id => !batch.includes(id))
            }));
          }
          
          setProgressCount(Math.min(i + BATCH_SIZE, versesToUpdate.length));
          await new Promise(resolve => setTimeout(resolve, 50)); // Brief pause for UI update
        }
        
      } else {
        // Use individual updates for smaller surahs (existing logic)
        console.log(`Using individual updates for ${selectedSurah.name} (${versesToUpdate.length} verses)`);
        
        const pendingUpdates: Array<() => Promise<void>> = versesToUpdate.map(verseId => {
          return isMarking 
            ? () => Promise.resolve(markVerseAsMemorized(verseId))
            : () => Promise.resolve(unmarkVerseAsMemorized(verseId));
        });

        // Process in batches with progress updates
        const BATCH_SIZE = 10;
        let processed = 0;

        for (let i = 0; i < pendingUpdates.length; i += BATCH_SIZE) {
          const batch = pendingUpdates.slice(i, i + BATCH_SIZE);
          
          await Promise.all(
            batch.map(async (fn) => {
              try {
                await fn();
              } catch (e) {
                console.error("Verse update failed:", e);
              }
            })
          );
          
          processed += batch.length;
          setProgressCount(processed);
          
          // Small delay for UI responsiveness
          if (i + BATCH_SIZE < pendingUpdates.length) {
            await new Promise(resolve => setTimeout(resolve, 25));
          }
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`✅ Successfully updated ${versesToUpdate.length} verses for ${selectedSurah.name} in ${duration}ms`);
      
    } catch (error) {
      console.error('Failed to update verses:', error);
      Alert.alert('Error', 'Failed to update verses. Please try again.');
    } finally {
      setProgressModalVisible(false);
      setProgressAction(null);
    }
  };

  const handleMarkAllRevised = async () => {
    if (!selectedSurah) return;

    const allSurahVerseIds = getSurahVerseRange(selectedSurah);
    const revisedSet = new Set(revisedVerses.map((v) => v.verseId));
    const isMarking = !surahStatus.isRevised;

    // Determine which verses need updating
    const versesToUpdate = allSurahVerseIds.filter(verseId => {
      if (isMarking) {
        return !revisedSet.has(verseId); // Only unrevised verses
      } else {
        return revisedSet.has(verseId); // Only revised verses
      }
    });

    if (versesToUpdate.length === 0) {
      Alert.alert('No Changes', 'All verses are already in the desired state.');
      return;
    }

    // Show progress modal
    setProgressAction(isMarking ? 'mark-revised' : 'unmark-revised');
    setProgressModalVisible(true);
    setProgressCount(0);

    try {
      const startTime = Date.now(); // Performance tracking
      
      // Use bulk update for larger surahs
      if (selectedSurah.versesCount >= BULK_UPDATE_THRESHOLD) {
        console.log(`Using bulk revision update for ${selectedSurah.name} (${versesToUpdate.length} verses)`);
        
        if (isMarking) {
          // Import the database function for bulk revision logging
          const { bulkLogRevisions } = await import('@/database/QuranDatabase');
          await bulkLogRevisions(versesToUpdate);
        }
        
        // Update local state in batches to show progress
        const BATCH_SIZE = 50;
        for (let i = 0; i < versesToUpdate.length; i += BATCH_SIZE) {
          const batch = versesToUpdate.slice(i, i + BATCH_SIZE);
          
          if (isMarking) {
            // Add revisions
            batch.forEach(verseId => {
              useProgressStore.setState((state) => {
                const exists = state.revisedVerses.some(rv => rv.verseId === verseId);
                if (!exists) {
                  const now = new Date();
                  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
                  const revision = {
                    verseId,
                    revisionDate: today, // Use revisionDate to match RevisedVerse interface
                  };
                  const tracker = {
                    verseId,
                    date: today, // Use date for tracker interfaces
                  };
                  return {
                    revisedVerses: [...state.revisedVerses, revision],
                    dailyRevisedVerses: [...state.dailyRevisedVerses, tracker],
                    weeklyRevisedVerses: [...state.weeklyRevisedVerses, tracker],
                  };
                }
                return state;
              });
            });
          } else {
            // Remove revisions
            useProgressStore.setState((state) => ({
              revisedVerses: state.revisedVerses.filter((rv) => !batch.includes(rv.verseId)),
              dailyRevisedVerses: state.dailyRevisedVerses.filter((rv) => !batch.includes(rv.verseId)),
              weeklyRevisedVerses: state.weeklyRevisedVerses.filter((rv) => !batch.includes(rv.verseId)),
            }));
          }
          
          setProgressCount(Math.min(i + BATCH_SIZE, versesToUpdate.length));
          await new Promise(resolve => setTimeout(resolve, 50)); // Brief pause for UI update
        }
        
      } else {
        // Use individual updates for smaller surahs (existing logic)
        console.log(`Using individual revision updates for ${selectedSurah.name} (${versesToUpdate.length} verses)`);
        
        const pendingUpdates: Array<() => Promise<void>> = versesToUpdate.map(verseId => {
          if (isMarking) {
            return () => Promise.resolve(markVerseAsRevised(verseId));
          } else {
            return () => {
              useProgressStore.setState((state) => ({
                revisedVerses: state.revisedVerses.filter((rv) => rv.verseId !== verseId),
                dailyRevisedVerses: state.dailyRevisedVerses.filter((rv) => rv.verseId !== verseId),
                weeklyRevisedVerses: state.weeklyRevisedVerses.filter((rv) => rv.verseId !== verseId),
              }));
              return Promise.resolve();
            };
          }
        });

        // Process in batches with progress updates
        const BATCH_SIZE = 10;
        let processed = 0;

        for (let i = 0; i < pendingUpdates.length; i += BATCH_SIZE) {
          const batch = pendingUpdates.slice(i, i + BATCH_SIZE);
          
          await Promise.all(
            batch.map(async (fn) => {
              try {
                await fn();
              } catch (e) {
                console.error("Verse revision update failed:", e);
              }
            })
          );
          
          processed += batch.length;
          setProgressCount(processed);
          
          // Small delay for UI responsiveness
          if (i + BATCH_SIZE < pendingUpdates.length) {
            await new Promise(resolve => setTimeout(resolve, 25));
          }
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`✅ Successfully updated ${versesToUpdate.length} verse revisions for ${selectedSurah.name} in ${duration}ms`);
      
    } catch (error) {
      console.error('Failed to update verse revisions:', error);
      Alert.alert('Error', 'Failed to update verse revisions. Please try again.');
    } finally {
      setProgressModalVisible(false);
      setProgressAction(null);
    }
  };

  
  // Full Surah audio (single continuous stream via islamic.network high quality)
  const handleToggleSurahAudio = useCallback(async () => {
    if (!selectedSurah) return;
    try {
      console.log('handleToggleSurahAudio called:', { isPlayingSurah, isSurahPaused });
      
      if (isPlayingSurah) {
        console.log('Currently playing - pausing surah audio');
        await pauseSurahAudio();
        setIsPlayingSurah(false);
        setIsSurahPaused(true);
        return;
      }
      
      // If paused, resume instead of starting new
      if (isSurahPaused) {
        console.log('Currently paused - resuming surah audio');
        await resumeSurahAudio();
        setIsPlayingSurah(true);
        setIsSurahPaused(false);
        return;
      }
      
      console.log('Starting new surah audio playback for surah:', selectedSurah.id);
      
      // Use the playSurah function with proper callback
      await playSurahAudioWithFallback(selectedSurah.id, 1, (status: any) => {
        console.log('Surah audio status update:', status);
        
        // Handle when audio finishes completely
        if (status?.didJustFinish) {
          console.log('Surah playback finished');
          setIsPlayingSurah(false);
          setIsSurahPaused(false);
          return;
        }
        
        // Handle when audio starts playing or resumes
        if (status?.isPlaying === true) {
          console.log('Surah playback started/resumed');
          setIsPlayingSurah(true);
          setIsSurahPaused(false);
          return;
        }
        
        // Only handle pause/stop if we explicitly know it's paused
        if (status?.isPaused === true && status?.isPlaying === false) {
          console.log('Surah playback paused');
          setIsPlayingSurah(false);
          setIsSurahPaused(true);
          return;
        }
        
        // Handle errors
        if (status?.error) {
          console.error('Surah playback error:', status.error);
          setIsPlayingSurah(false);
          setIsSurahPaused(false);
        }
        
        // Log fallback usage
        if (status?.fallbackUsed) {
          console.log('Using fallback reciter for surah audio');
        }
      });
      
      // Set playing state immediately after starting
      setIsPlayingSurah(true);
      setIsSurahPaused(false);
      console.log('Surah audio started successfully');
    } catch (e) {
      console.error('Surah audio playback failed:', e);
      setIsPlayingSurah(false);
      setIsSurahPaused(false);
    }
  }, [selectedSurah, isPlayingSurah, isSurahPaused]);

  // Cleanup behavior: don't force-pause on unmount to allow iOS background playback
  useEffect(() => {
    return () => {
      // Intentionally not forcing pause here; background playback should continue
    };
  }, []);

  // Pause surah audio when switching to another surah
  useEffect(() => {
    if (!selectedSurah) return;
    (async () => {
      try { await pauseSurahAudio(); } catch {}
      setIsPlayingSurah(false);
      setIsSurahPaused(false);
    })();
  }, [selectedSurah?.id]);

  // Old renderVerse removed - now using optimized version above
  // renderVerseOptimized is defined with stable callback references above

  const formatDate = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = date.getDate();
    const m = months[date.getMonth()];
    const y = date.getFullYear();
    return `${d} ${m} ${y}`;
  };

  // Helper: get completion (khatm) date for a surah using per-verse memorization dates
  const getSurahCompletionDate = (surahId: number) => {
    const surah = surahsData.find(s => s.id === surahId);
    if (!surah) return null;
    const allIds = getSurahVerseRange({ id: surah.id, versesCount: surah.versesCount });
    const memSet = new Set(memorizedVerses);
    const isFull = allIds.every(id => memSet.has(id));
    if (!isFull) return null;
    // Pick the latest memorization date among verses in this surah
    let latest: Date | null = null;
    for (const id of allIds) {
      const ds = memorizedVerseDates?.[id];
      if (ds) {
        const d = new Date(ds);
        if (!latest || d > latest) latest = d;
      }
    }
    return latest || null;
  };

  const renderSurahItem = ({ item }: { item: Surah }) => {
    const surahProgress = calculateSurahProgress(item.id);
    const progressColor = getProgressColor(surahProgress.progress);
    const cachedData = getCachedSurahVerses(item.id, translationLanguage);
    const isCached = cachedData.verses.length > 0;
    const revelationDisplay = item.revelationType === 'Medinan' ? 'Madani' : 'Makki';
    const showKhatm = Math.round(surahProgress.progress) === 100;
    const completionDate = showKhatm ? getSurahCompletionDate(item.id) : null;
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
          <View style={styles.surahDetailsRow}>
            <Text style={[styles.surahDetails, { color: '#888888' }]}> {item.versesCount} verses • <Text style={{ color: '#4CAF50' }}>{revelationDisplay}</Text> </Text>
            {showKhatm && completionDate && (
              <Text style={styles.khatamDate}>{formatDate(completionDate)} : ختم</Text>
            )}
          </View>
        </View>
        <View style={[styles.progressPill, { backgroundColor: progressColor }]}> 
          <Text style={styles.progressText}>{Math.round(surahProgress.progress)}%</Text>
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




    
    // On mount, if lastViewedSurahId is set, open that surah directly
  useEffect(() => {
    if (lastViewedSurahId && !selectedSurah) {
      if (suppressNextAutoOpen.current) {
        // Skip auto-open while suppression is active
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
  }, [translationLanguage, selectedSurah, loadInitialVerses]);

  // Consolidated font/tajweed cache invalidation and conditional refetch
  useEffect(() => {
    if (!selectedSurah) {
      for (const [key] of verseCache.entries()) {
        if (key.includes(`_${translationLanguage}_`)) {
          verseCache.delete(key);
          removeKeyFromOrder(key);
        }
      }
      return;
    }
    const hasVerses = verses.length > 0;
    const hasTajweedText = hasVerses && verses.every(v => !!(v as any).tajweedText);
    const shouldUseTajweed = arabicFont === 'tajweed';
    const needsRefetch = (shouldUseTajweed && !hasTajweedText) || (!shouldUseTajweed && hasTajweedText);
    if (needsRefetch) {
      clearSurahCache(selectedSurah.id, translationLanguage);
      setVerses([]);
      setCurrentPage(1);
      setHasMoreVerses(true);
      loadInitialVerses(selectedSurah);
    }
  }, [arabicFont, selectedSurah, translationLanguage, clearSurahCache, loadInitialVerses]);

  // Handle deep-link style params from Home: open surah and optionally scroll to verse
  useEffect(() => {
    const sid = paramSurahId ? Number(paramSurahId) : undefined;
    const vid = paramVerseId ? Number(paramVerseId) : undefined;
    if (sid && !Number.isNaN(sid)) {
      const surah = surahsData.find(s => s.id === sid);
      if (surah && !suppressNextAutoOpen.current) {
        setSelectedSurah(surah);
        setLastViewedSurahId(surah.id);
        if (vid && !Number.isNaN(vid)) {
          targetVerseRef.current = vid;
        }
        loadInitialVerses(surah);
      }
    }
  }, [paramSurahId, paramVerseId, setLastViewedSurahId, loadInitialVerses]);

  // Re-run param handling whenever screen regains focus (covers Android occasional missed mount param processing)
  useFocusEffect(
    useCallback(() => {
      const sid = paramSurahId ? Number(paramSurahId) : undefined;
      const vid = paramVerseId ? Number(paramVerseId) : undefined;
      if (sid && !Number.isNaN(sid)) {
        // Only reopen if not already on the same surah
        if ((!selectedSurah || selectedSurah.id !== sid) && !suppressNextAutoOpen.current) {
          const surah = surahsData.find(s => s.id === sid);
            if (surah) {
              setSelectedSurah(surah);
              setLastViewedSurahId(surah.id);
              if (vid && !Number.isNaN(vid)) targetVerseRef.current = vid;
              loadInitialVerses(surah);
            }
        }
      }
      // No cleanup needed
      return () => {};
    }, [paramSurahId, paramVerseId, selectedSurah, loadInitialVerses, setLastViewedSurahId])
  );

  // Android-specific subtle race fallback: after a short delay if params exist but surah not opened, retry once
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sid = paramSurahId ? Number(paramSurahId) : undefined;
    if (!sid) return;
    if (selectedSurah && selectedSurah.id === sid) return; // already opened
    const timeout = setTimeout(() => {
      if (!selectedSurah && !suppressNextAutoOpen.current) {
        const surah = surahsData.find(s => s.id === sid);
        if (surah) {
          console.log('[read] Fallback re-open surah due to initial miss (Android)', sid);
          setSelectedSurah(surah);
          setLastViewedSurahId(surah.id);
          loadInitialVerses(surah);
        }
      }
    }, 180); // small delay to allow route params to settle
    return () => clearTimeout(timeout);
  }, [paramSurahId, selectedSurah, loadInitialVerses, setLastViewedSurahId]);

  // After verses load, scroll to the requested verse if any
  // Keep the ref updated whenever verses state changes so async handlers can read latest
  useEffect(() => { 
    versesRef.current = verses; 
  }, [verses]);

  // FIXED: Scroll to verse only after loading completes
  useEffect(() => {
    let cancelled = false;
    const desired = targetVerseRef.current;
    
    // Wait until we have a surah, a target verse, verses loaded, and loading is complete
    if (!selectedSurah || !desired || isLoading || verses.length === 0) {
      return;
    }

    // Improved scrollToVerseIndex helper with better error handling
    const scrollToVerseIndexImproved = (targetIdx: number) => {
      if (!versesListRef.current) {
        console.warn('[read] scrollToVerseIndex: versesListRef not ready');
        return;
      }
      const list = versesRef.current;
      if (!list || list.length === 0) {
        console.warn('[read] scrollToVerseIndex: verses empty');
        return;
      }
      if (targetIdx < 0 || targetIdx >= list.length) {
        console.warn('[read] scrollToVerseIndex: index out of range', { targetIdx, length: list.length });
        // Fallback to closest valid index
        targetIdx = Math.max(0, Math.min(targetIdx, list.length - 1));
      }

      console.log(`[read] Attempting to scroll to index ${targetIdx} of ${list.length} verses`);

      try {
        versesListRef.current.scrollToIndex({ 
          index: targetIdx, 
          animated: true, 
          viewPosition: 0.3  // Changed from 0.5 - positions verse closer to top for better visibility
        });
      } catch (err) {
        console.warn('[read] scrollToIndex failed, falling back to offset', err);
        const estimatedOffset = Math.max(0, Math.round(targetIdx * (averageVerseHeight || 200)));
        try {
          versesListRef.current.scrollToOffset({ offset: estimatedOffset, animated: true });
        } catch (e) {
          console.warn('[read] scrollToOffset fallback also failed', e);
        }
      }
    };

    const findAndScroll = async () => {
      // Helper to check current loaded verses
      const findIndex = () => {
        const idx = versesRef.current.findIndex(v => v.verseNumber === desired);
        if (idx >= 0) {
          console.log(`[read] Found verse at index ${idx}: verseNumber=${versesRef.current[idx].verseNumber}, looking for=${desired}`);
        }
        return idx;
      };

      // First quick check - maybe it's already loaded
      let idx = findIndex();
      if (idx >= 0) {
        console.log(`[read] ✓ Found target verse ${desired} at index ${idx} (out of ${versesRef.current.length} verses), scrolling...`);
        // Add a delay to ensure FlatList has rendered
        setTimeout(() => {
          scrollToVerseIndex(idx);
          targetVerseRef.current = null;
        }, 300); // Increased delay for better reliability
        return;
      }

      console.log(`[read] ✗ Verse ${desired} not found in ${versesRef.current.length} loaded verses (have verses 1-${versesRef.current[versesRef.current.length - 1]?.verseNumber || 0}), loading more...`);

      // Otherwise, keep loading more pages while available until we find the verse
      let attempts = 0;
      const maxAttempts = 50; // Safety limit to prevent infinite loops
      
      while (!cancelled && idx === -1 && hasMoreVerses && attempts < maxAttempts) {
        attempts++;
        const currentVerseCount = versesRef.current.length;
        const lastVerseNum = versesRef.current[versesRef.current.length - 1]?.verseNumber || 0;

        console.log(`[read] Loading more verses (attempt ${attempts}/${maxAttempts}), currently have ${currentVerseCount} verses (1-${lastVerseNum}), need verse ${desired}...`);

        try {
          // Use the returned updated verses to avoid races with state propagation
          const updated = await loadMoreVerses();

          // If no new verses were added (length didn't increase), break to avoid an infinite loop
          const afterCount = updated.length;
          if (afterCount <= currentVerseCount) {
            console.log('[read] loadMoreVerses returned no new verses, breaking out to avoid infinite loop');
            break;
          }

          // Small pause to allow FlatList to render new items
          await new Promise(res => setTimeout(res, 200));

          console.log(`[read] After loading: now have ${afterCount} verses (1-${updated[updated.length - 1]?.verseNumber || 0})`);

          // Check with updated array
          idx = updated.findIndex(v => v.verseNumber === desired);

          if (idx >= 0) {
            console.log(`[read] ✓ Found verse ${desired} at index ${idx} after ${attempts} attempts, scrolling...`);
            // Extra delay after loading to ensure FlatList has rendered all items
            setTimeout(() => {
              scrollToVerseIndex(idx);
              targetVerseRef.current = null;
            }, 400);
            return;
          } else {
            console.log(`[read] ✗ Still haven't found verse ${desired}, continuing...`);
          }
        } catch (e) {
          console.error(`[read] Error loading more verses:`, e);
          // Continue trying if we haven't hit max attempts
        }
      }

      // If we exit loop and didn't find the verse
      if (!cancelled) {
        if (idx === -1 && !hasMoreVerses) {
          console.warn(`[read] Verse ${desired} not found after loading all verses`);
          targetVerseRef.current = null;
          
          // Fallback: scroll to top if verse not found
          setTimeout(() => {
            versesListRef.current?.scrollToOffset({ offset: 0, animated: true });
          }, 200);
        } else if (attempts >= maxAttempts) {
          console.warn(`[read] Max attempts reached while searching for verse ${desired}`);
          targetVerseRef.current = null;
        }
      }
    };

    findAndScroll();
    return () => { cancelled = true; };
  }, [selectedSurah, hasMoreVerses, loadMoreVerses, isLoading, verses.length]); // Added isLoading and verses.length

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
            <View style={[styles.headerTitleContainer, { alignItems: 'center' }]}>
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', marginBottom:4 }}>
                <Text style={styles.headerTitle}>{`${selectedSurah.id}. ${selectedSurah.englishName}`}</Text>
                <TouchableOpacity
                  onPress={handleToggleSurahAudio}
                  style={{
                    marginLeft:10,
                    backgroundColor: isPlayingSurah ? '#FFD700' : '#333333',
                    borderRadius: 22,
                    width:42,
                    height:42,
                    justifyContent:'center',
                    alignItems:'center',
                    borderWidth:1,
                    borderColor: isPlayingSurah ? '#FFD700' : '#555555',
                    shadowColor:'#000',
                    shadowOpacity:0.3,
                    shadowRadius:4,
                    shadowOffset:{ width:0, height:2 }
                  }}
                  activeOpacity={0.8}
                >
                  {isPlayingSurah ? <Pause size={22} color="#1a1a1a" /> : <Play size={22} color="#FFD700" />}
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 8, marginTop: 6 }}>
                <View style={{ flex: 0.25, alignItems: 'flex-start' }}>
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
                </View>
                <View style={{ flex: 0.5, alignItems: 'center' }}>
                  <Text style={[styles.headerSubtitle, { 
                    fontFamily: getArabicFontFamily(),
                    ...headerArabicTypography,
                    textAlign: 'center',
                    color: '#ffffff'
                  }]}>{selectedSurah.arabicName}</Text>
                </View>
                <View style={{ flex: 0.25, alignItems: 'flex-end' }}>
                  <Text style={{ color: '#ffffff', fontSize: 12 }}>
                    {selectedSurah.versesCount} verses
                  </Text>
                </View>
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
            <Pressable 
              style={[styles.actionButton, surahStatus.isMemorized ? styles.actionButtonActive : null]} 
              android_ripple={{ color: 'transparent' }}
              onPress={handleMarkAllMemorized}
            >
              <CheckCircle size={20} color="#ffffff" />
              <Text
                style={styles.actionButtonText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {surahStatus.isMemorized ? 'Unmark ❌' : 'Mark Memorized'}
              </Text>
            </Pressable>
            <Pressable 
              style={[styles.actionButton, surahStatus.isRevised ? styles.actionButtonRevised : null]} 
              android_ripple={{ color: 'transparent' }}
              onPress={handleMarkAllRevised}
            >
              <RefreshCw size={20} color="#ffffff" />
              <Text
                style={styles.actionButtonText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {surahStatus.isRevised ? 'Unmark ❌' : 'Mark Revision'}
              </Text>
            </Pressable>
          </View>
        )}
        </View>

      {/* Tabs + Search - Always visible, no jumping */}
      {!selectedSurah && (
        <>
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
            <View style={[styles.searchInputWrapper, { flex: 1 }]}>
              <Search size={20} color="#888888" style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: '#ffffff' }]}
                placeholder="Search surahs..."
                placeholderTextColor="#888888"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.clearButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={18} color="#888888" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </>
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
                ref={versesListRef}
                data={verses}
                renderItem={renderVerseOptimized}
                keyExtractor={(item) => `v-${item.id}`}
                contentContainerStyle={[styles.versesContent, { backgroundColor: '#1a1a1a' }]}
                onEndReached={loadMoreVerses}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={renderEmpty}
                showsVerticalScrollIndicator={true}
                removeClippedSubviews={true}
                maxToRenderPerBatch={8}
                windowSize={10}
                initialNumToRender={8}
                style={{ backgroundColor: '#1a1a1a' }}
                getItemLayout={(data, index) => ({ length: averageVerseHeight, offset: averageVerseHeight * index, index })}
                onScrollToIndexFailed={(info) => {
                  console.warn('[read] onScrollToIndexFailed', info);
                  const avg = info.averageItemLength || averageVerseHeight || 200;
                  const offset = Math.max(0, Math.round(info.index * avg));
                  setTimeout(() => {
                    try { versesListRef.current?.scrollToOffset({ offset, animated: true }); } catch (e) { console.warn('[read] scrollToOffset failed in handler', e); }
                  }, 120);
                }}
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
              onScroll={(e) => {
                // Track scroll position without state updates
                scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={400} // Only update every 400ms to avoid performance issues
              getItemLayout={(data, index) => ({ length: SURAH_ITEM_HEIGHT, offset: SURAH_ITEM_HEIGHT * index, index })}
              initialNumToRender={12}
              windowSize={12}
              maxToRenderPerBatch={12}
              removeClippedSubviews
            />
          ) : (
            <JuzMemorization />
          )
        )}
      </View>
    </View>
  );
}

// Average verse height estimation (sample-based) for getItemLayout
const SURAH_ITEM_HEIGHT = 80; // Approximate fixed height for surah list rows

// Hook-level memo: placed after component definition to avoid reorder of hooks above
// We'll compute averageVerseHeight inside component via useMemo; define default below in case of early reference.

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  headerContainer: {
    paddingTop: 12,
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
    marginTop: 4,
    paddingHorizontal: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  backgroundColor: '#505050',
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
    color: '#ffffff',
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
  surahDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
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
  clearButton: {
    marginLeft: 8,
    padding: 2,
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
  khatamDate: {
    color: '#4CAF50',
    fontFamily: 'ScheherazadeNew-Regular',
    fontSize: 12,
    textAlign: 'right',
    marginLeft: 8,
  },
});