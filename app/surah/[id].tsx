import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, Pressable, Alert, RefreshControl, Modal, InteractionManager, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Play, Pause, RefreshCw, Wifi, WifiOff, Download, CheckCircle2, Circle, BookMarked, BookX, CheckCircle, ArrowLeft } from 'lucide-react-native';
import { useCustomColors } from '@/utils/themeUtils';
import { useQuranStore } from '@/store/quranStore';
import { useProgressStore } from '@/store/progressStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Verse } from '@/types';
import { getSurahById } from '@/data/surahs';
import VerseItem from '@/components/VerseItem';
import { playAudio, pauseAudio, playSurahAudio } from '@/utils/audioUtils';
import { checkNetworkConnectivity, fetchVersesBySurah, smartDownloadSurah } from '@/services/quranApi';
import { 
  getCachedVerses, 
  isSurahFullyCached, 
  isSurahCached,
  getVerseMemorizationStatus,
  setVerseMemorizationStatus,
  markAllVersesMemorized,
  getSurahDownloadStatus
} from '@/database/QuranDatabase';
import { surahsData } from '@/data/surahs';
import { ThemeColors } from '@/types';
import { calculateVerseId } from '@/utils/verseUtils';
import { Platform } from 'react-native';
import { getLastRead } from '@/utils/lastReadUtils';

const PAGE_SIZE = 10;
const BATCH_SIZE = 25;

export default function SurahScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const surahId = parseInt(id || '1');
  
  const colors = useCustomColors();
  const { clearError, error } = useQuranStore();
  const { memorizedVerses, revisedVerses, setLastReadVerse, markVerseAsMemorized, unmarkVerseAsMemorized, markVerseAsRevised } = useProgressStore();
  const { autoPlayAudio, arabicFont, fontSizeArabic } = useSettingsStore();
  
  const [surah, setSurah] = useState(getSurahById(surahId));
  const [verses, setVerses] = useState<Verse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPlayingSurahAudio, setIsPlayingSurahAudio] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isCached, setIsCached] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreVerses, setHasMoreVerses] = useState(true);
  
  // State to track if the current surah is fully memorized
  const [isCurrentSurahMemorized, setIsCurrentSurahMemorized] = useState(false);
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [progressCount, setProgressCount] = useState(0);
  const [progressAction, setProgressAction] = useState<'mark-memorized' | 'unmark-memorized' | 'mark-revised' | 'unmark-revised' | null>(null);
  
  // Ref to track if component is mounted
  const isMounted = useRef(true);
  const flatListRef = useRef<FlatList>(null);
  
  // Helper function to get Arabic font family (same as VerseItem)
  const getArabicFontFamily = () => {
    switch (arabicFont) {
      case 'amiri-quran':
        return 'AmiriQuran-Regular';
      case 'scheherazade':
        return 'ScheherazadeNew-Regular';
      case 'scheherazade-bold':
        return 'ScheherazadeNew-Bold';
      case 'tajweed':
        return 'ScheherazadeNew-Regular'; // Use Scheherazade for Tajweed mode
      case 'indo-pak':
        return 'NooreHuda-Regular';
      default:
        // For system default, provide fallback Arabic fonts that are commonly available
        return Platform.select({
          ios: 'Arial, Helvetica Neue, Helvetica', // iOS has good Arabic support with these fonts
          android: 'Roboto, Noto Sans Arabic, Arial', // Android's fonts with good Arabic support
          default: 'Arial, Helvetica, sans-serif' // Fallback for other platforms
        });
    }
  };
  
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Helper function to get verse range for a surah
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
  
  // Calculate surah status for memorization and revision
  const surahStatus = useMemo(() => {
    if (!surah) return { isMemorized: false, isRevised: false };
    
    const allVerseIds = getSurahVerseRange({ id: surah.id, versesCount: surah.versesCount });
    const memorizedSet = new Set(memorizedVerses);
    const revisedSet = new Set(revisedVerses.map(v => v.verseId));
    
    const memorizedCount = allVerseIds.filter(id => memorizedSet.has(id)).length;
    const revisedCount = allVerseIds.filter(id => revisedSet.has(id)).length;
    
    return {
      isMemorized: memorizedCount === allVerseIds.length,
      isRevised: revisedCount === allVerseIds.length
    };
  }, [surah, memorizedVerses, revisedVerses, getSurahVerseRange]);
  
  // Function to check if the current surah is fully memorized
  const checkIfSurahIsMemorized = useCallback(async () => {
    if (!surah) return false;

    try {
      // Get all verses for the surah
      const verses = await getCachedVerses(surahId, 1, surah.versesCount);

      // Check if all verses are memorized
      for (const verse of verses) {
        const isMemorized = await getVerseMemorizationStatus(surahId, verse.verseNumber);
        if (!isMemorized) {
          return false;
      }
    }
      return true;
    } catch (error) {
      console.error('Error checking if surah is memorized:', error);
      return false;
    }
  }, [surah, surahId]);
  
  // Effect to update isCurrentSurahMemorized state
  useEffect(() => {
    checkIfSurahIsMemorized().then(setIsCurrentSurahMemorized);
  }, [surahId, checkIfSurahIsMemorized]);
  
  // Check network connectivity
  const checkConnectivity = useCallback(async () => {
    const online = await checkNetworkConnectivity();
    if (isMounted.current) {
      setIsOnline(online);
    }
    return online;
  }, []);
  
  // MAIN LOADING FUNCTION - Database first, then network fallback
  const loadVerses = useCallback(async (page: number, isInitialLoad: boolean = false) => {
    if (!surah) return;
    
    try {
      if (isInitialLoad) {
        setIsLoading(true);
    setLoadingError(null);
      clearError();
        console.log(`=== INITIAL LOAD: Surah ${surahId} (${surah.name}) ===`);
      } else {
        setIsLoadingMore(true);
        console.log(`=== LOAD MORE: Surah ${surahId}, Page ${page} ===`);
      }
      
      // STEP 1: Always check database first
      console.log(`1. Checking database for surah ${surahId}, page ${page}`);
      const cachedVerses = await getCachedVerses(surahId, page, PAGE_SIZE);
      console.log(`   Database returned: ${cachedVerses.length} verses`);
      
        if (cachedVerses.length > 0) {
        // SUCCESS: Found verses in database
        console.log(`✅ SUCCESS: Using ${cachedVerses.length} cached verses`);
        
        if (isInitialLoad) {
          setVerses(cachedVerses);
          setCurrentPage(1);
          if (cachedVerses.length > 0) {
          setLastReadVerse(cachedVerses[0]);
          }
        } else {
          setVerses(prev => [...prev, ...cachedVerses]);
          setCurrentPage(page);
        }
        
        // Check if we have more verses to load
        const totalLoaded = isInitialLoad ? cachedVerses.length : verses.length + cachedVerses.length;
        setHasMoreVerses(totalLoaded < surah.versesCount);
        
        // Check cache status
        const fullyCached = await isSurahFullyCached(surahId);
        setIsCached(fullyCached);
        
        console.log(`   Total loaded: ${totalLoaded}/${surah.versesCount}, Has more: ${totalLoaded < surah.versesCount}`);
        
      } else {
        // FALLBACK: No cached data, try network
        console.log(`2. No cached data, checking network...`);
        
        const online = await checkConnectivity();
        if (!online) {
          console.log(`❌ FAIL: No network connection`);
          if (isInitialLoad) {
            setLoadingError("No cached data and no internet connection. Please download this surah for offline reading or check your connection.");
          }
          return;
        }
        
        console.log(`3. Fetching from network: surah ${surahId}, page ${page}`);
        const { verses: networkVerses } = await fetchVersesBySurah(surahId, page, PAGE_SIZE);
        console.log(`   Network returned: ${networkVerses.length} verses`);
        
        if (networkVerses.length > 0) {
          console.log(`✅ SUCCESS: Using ${networkVerses.length} network verses`);
          
          if (isInitialLoad) {
            setVerses(networkVerses);
            setCurrentPage(1);
            if (networkVerses.length > 0) {
              setLastReadVerse(networkVerses[0]);
            }
          } else {
            setVerses(prev => [...prev, ...networkVerses]);
            setCurrentPage(page);
          }
          
          // Check if we have more verses to load
          const totalLoaded = isInitialLoad ? networkVerses.length : verses.length + networkVerses.length;
          setHasMoreVerses(totalLoaded < surah.versesCount);
          
          console.log(`   Total loaded: ${totalLoaded}/${surah.versesCount}, Has more: ${totalLoaded < surah.versesCount}`);
          
        } else {
          console.log(`❌ FAIL: No verses from network`);
          if (isInitialLoad) {
            setLoadingError(`No verses available for ${surah.name}. Please try again.`);
            }
          }
        }
      
    } catch (err) {
      console.error(`❌ ERROR loading verses:`, err);
      if (!isMounted.current) return;
      
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      if (isInitialLoad) {
        setLoadingError(`Failed to load verses: ${errorMessage}`);
        setVerses([]);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
        setIsRefreshing(false);
      }
    }
  }, [surah, surahId, verses.length, clearError, checkConnectivity, setLastReadVerse]);
  
  // Load more verses (pagination)
  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMoreVerses && !isLoading) {
      const nextPage = currentPage + 1;
      console.log(`📱 USER ACTION: Load more (page ${nextPage})`);
      loadVerses(nextPage, false);
    }
  }, [isLoadingMore, hasMoreVerses, isLoading, currentPage, loadVerses]);
  
  // Initialize surah data
  useEffect(() => {
    const initializeSurah = async () => {
      try {
        const surahData = getSurahById(surahId);
        if (surahData) {
          setSurah(surahData);
          // Load initial verses
          await loadVerses(1, true);
        // Auto-play audio if enabled
          if (autoPlayAudio && surahData.audioUrl) {
            // Create a verse object for the surah audio
            const surahVerse: Verse = {
              id: 0,
              surahId: surahData.id,
              verseNumber: 0,
              arabicText: surahData.arabicName,
              translation: surahData.englishName,
              audioUrl: surahData.audioUrl,
              juzNumber: 1,
              hizbNumber: 1,
              pageNumber: 1
            };
            handlePlayAudio(surahVerse);
          }
        }
      } catch (error) {
        console.error('Error initializing surah:', error);
      }
    };
    
    initializeSurah();
  }, [surahId, autoPlayAudio, loadVerses]);
  
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
              if (status.isPlaying === false) {
                setIsPlayingAudio(false);
              }
              if (status.didJustFinish) {
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
  
  // Handle playing full surah audio
  const handlePlaySurahAudio = async () => {
    if (!surah) return;
    
    try {
      if (isPlayingSurahAudio) {
        await pauseAudio();
        setIsPlayingSurahAudio(false);
      } else {
        await playSurahAudio(surahId, (status) => {
          if (status.didJustFinish) {
            setIsPlayingSurahAudio(false);
          }
        });
        setIsPlayingSurahAudio(true);
      }
    } catch (error) {
      console.error('Error playing surah audio:', error);
      Alert.alert(
        "Audio Error", 
        "Failed to play surah audio. Please check your internet connection and try again.",
        [{ text: "OK" }]
      );
      setIsPlayingSurahAudio(false);
    }
  };
  
  const isVerseMemorizedSync = (verseId: number) => {
    const verse = verses.find(v => v.id === verseId);
    if (!verse) return false;
    // If verse has a property like isMemorized, use it; otherwise, fallback to memorizedVerses array
    return memorizedVerses.includes(verseId);
  };
  
  const isVerseRevised = (verseId: number) => {
    return revisedVerses.some(revised => revised.verseId === verseId);
  };
  
  const handleRetry = async () => {
    console.log(`🔄 USER ACTION: Retry loading`);
    await loadVerses(1, true);
  };
  
  const handleRefresh = async () => {
    console.log(`🔄 USER ACTION: Pull to refresh`);
    setIsRefreshing(true);
    setCurrentPage(1);
    setVerses([]);
    await loadVerses(1, true);
  };
  
  const handleDownloadSurah = async () => {
    if (!surah) return;

    try {
      const downloadStatus = await getSurahDownloadStatus(surahId);
      
      if (downloadStatus.isFullyDownloaded) {
        Alert.alert(
          "Already Downloaded",
          `${surah.name} is already fully downloaded.`,
          [{ text: "OK" }]
        );
        return;
      }

      const online = await checkConnectivity();
      if (!online) {
        Alert.alert(
          "No Internet Connection",
          "Please check your internet connection and try again.",
          [{ text: "OK" }]
        );
        return;
      }

      Alert.alert(
        "Download Surah",
        `Do you want to download ${surah.name} for offline reading?`,
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Download",
            onPress: async () => {
              try {
                await smartDownloadSurah(surahId);
                const fullyCached = await isSurahFullyCached(surahId);
                setIsCached(fullyCached);
                Alert.alert("Success", `${surah.name} has been downloaded successfully.`);
              } catch (error) {
                console.error('Error downloading surah:', error);
                Alert.alert("Error", "Failed to download surah. Please try again.");
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error checking download status:', error);
      Alert.alert("Error", "Failed to check download status. Please try again.");
    }
  };
  
  // Handle marking all verses in the surah as memorized
  const handleMarkAllMemorized = async () => {
    if (!surah) return;

    const allSurahVerseIds = getSurahVerseRange(surah);
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

    const { InteractionManager } = require('react-native');
    InteractionManager.runAfterInteractions(() => {
      processNextBatch();
    });
  };

  const handleMarkAllRevised = async () => {
    if (!surah) return;

    const allSurahVerseIds = getSurahVerseRange(surah);
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

    const { InteractionManager } = require('react-native');
    InteractionManager.runAfterInteractions(() => {
      processNextBatch();
    });
  };

  // Progress modal component
  const renderProgressModal = () => (
    <Modal
      visible={progressModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
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
          <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 24 }} />
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
            {progressAction === 'mark-memorized' && 'Marking Memorized...'}
            {progressAction === 'unmark-memorized' && 'Unmarking Memorized...'}
            {progressAction === 'mark-revised' && 'Marking Revised...'}
            {progressAction === 'unmark-revised' && 'Unmarking Revised...'}
          </Text>
          <View style={{ width: 180, height: 8, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden', marginVertical: 16 }}>
            <View style={{
              width: `${Math.max(5, Math.round((progressCount / (surah?.versesCount || 1)) * 100))}%`,
              height: '100%',
              backgroundColor: colors.primary,
              borderRadius: 4,
            }} />
          </View>
          <Text style={{ color: '#aaa', fontSize: 14 }}>{progressCount} / {surah?.versesCount || 0} verses</Text>
          <Text style={{ color: '#888', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
            Please wait while the update completes. Navigation is disabled during this process.
          </Text>
        </View>
      </View>
    </Modal>
  );
  
  const renderVerse = ({ item: verse }: { item: Verse }) => (
    <VerseItem 
      verse={verse} 
      isMemorized={() => isVerseMemorizedSync(verse.id)}
      isRevised={() => revisedVerses.some(revised => revised.verseId === verse.id)}
      onMemorizeToggle={async () => {
        const currentStatus = await getVerseMemorizationStatus(surahId, verse.verseNumber);
        await setVerseMemorizationStatus(surahId, verse.verseNumber, !currentStatus);
        // Update the progress store as well
        const globalVerseId = calculateVerseId(surahId, verse.verseNumber);
        if (!currentStatus) {
          markVerseAsMemorized(globalVerseId);
        } else {
          unmarkVerseAsMemorized(globalVerseId);
        }
        checkIfSurahIsMemorized().then(setIsCurrentSurahMemorized);
      }}
      onRevisionToggle={() => {}}
      onPlayAudio={async () => handlePlayAudio(verse)}
    />
  );
  
  const renderFooter = () => {
    if (isLoadingMore) {
    return (
      <View style={styles.footer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading more verses...</Text>
        </View>
      );
    }
    
    if (hasMoreVerses && !loadingError) {
      return (
        <View style={styles.footer}>
          <Pressable style={[styles.loadMoreButton, { borderColor: colors.primary }]} onPress={handleLoadMore}>
            <Text style={[styles.loadMoreText, { color: colors.primary }]}>Load More Verses ({verses.length}/{surah?.versesCount || 0})</Text>
            </Pressable>
        </View>
      );
    }
    
    if (loadingError && !isRefreshing && !isLoading) {
      return (
        <View style={styles.footer}>
          <Pressable style={styles.retryButton} onPress={handleRetry}>
            <RefreshCw size={16} color={colors.warning} />
             <Text style={[styles.retryButtonText, { color: colors.warning }]}>Retry Loading</Text>
          </Pressable>
      </View>
    );
    }
    
    return null;
  };
  
  // Define styles as a function that accepts colors
  const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
      flex: 1,
    },
    headerIcon: {
      marginRight: 16,
    },
    headerIcons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cachedIndicator: {
      marginRight: 16,
    },
    cachedText: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginLeft: 8,
      fontSize: 14,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    errorText: {
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 16,
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
    },
    retryButtonText: {
      marginLeft: 8,
      fontSize: 16,
      fontWeight: '600',
    },
    footer: {
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    loadMoreButton: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
    },
    loadMoreText: {
      fontSize: 16,
      fontWeight: '600',
    },
    centeredMessage: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContentContainer: {
      paddingVertical: 0,
      paddingHorizontal: 16,
    },
    markAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1.5,
    },
    markAllIconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markAllButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    surahHeader: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
      marginBottom: 8,
    },
    surahTitleContainer: {
      alignItems: 'center',
      marginBottom: 12,
    },
    surahArabicName: {
      fontSize: 28,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 8,
    },
    surahEnglishName: {
      fontSize: 18,
      textAlign: 'center',
      marginBottom: 4,
    },
    surahInfo: {
      fontSize: 14,
    },
    surahInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    },
    playSurahButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1.5,
      backgroundColor: 'transparent',
    },
    playSurahButtonText: {
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 6,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    headerContainer: {
      paddingTop: 44,
      paddingBottom: 8,
      paddingHorizontal: 16,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    headerTitleContainer: {
      flex: 1,
      marginLeft: 12,
    },
    headerTitle: {
      fontSize: 20.8,
      fontWeight: '600',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      marginTop: 0,
      marginBottom: 8,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1.5,
      flex: 1,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 8,
    },
  });

  const styles = createStyles(colors);

  useEffect(() => {
    const scrollToLastRead = async () => {
      const { surahId: lastSurahId, verseId: lastVerseId } = await getLastRead();
      if (lastSurahId === surahId && lastVerseId && flatListRef.current) {
        const index = verses.findIndex(verse => verse.id === lastVerseId);
        if (index !== -1) {
          flatListRef.current.scrollToIndex({ index, animated: true });
        }
      }
    };

    scrollToLastRead();
  }, [surahId, verses]);
  
  if (!surah) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>
          Surah not found
        </Text>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderProgressModal()}
      <Stack.Screen
        options={{
          headerShown: false, // Hide the default header
        }}
      />
      
      {/* Custom Header */}
      <View style={[styles.headerContainer, { backgroundColor: colors.background }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <ArrowLeft size={28} color="#FFD700" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { 
              color: colors.text,
              fontFamily: getArabicFontFamily(),
              fontSize: 20.8
            }]}>
              {surah.englishName} ({surah.arabicName})
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
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
                {(surah.revelationType === 'Medinan' ? 'Madani' : 'Makki')}
              </Text>
              <Text style={{ color: '#4CAF50', fontSize: 12 }}>
                {surah.versesCount} verses
              </Text>
            </View>
          </View>
          {!isCached && isOnline ? (
            <TouchableOpacity onPress={handleDownloadSurah} style={{ padding: 8 }}>
              <Download size={24} color={colors.text} />
            </TouchableOpacity>
          ) : isCached ? (
            <View style={{ padding: 8 }}>
              <Text style={{ color: colors.primary, fontSize: 20, fontWeight: 'bold' }}>✓</Text>
            </View>
          ) : null}
        </View>
        
        {/* Play Surah Button */}
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <Pressable 
            style={[styles.playSurahButton, { 
              borderColor: '#4CAF50',
              backgroundColor: isPlayingSurahAudio ? '#4CAF50' : 'transparent'
            }]} 
            onPress={handlePlaySurahAudio}
          >
            {isPlayingSurahAudio ? (
              <Pause size={18} color="#ffffff" />
            ) : (
              <Play size={18} color="#4CAF50" />
            )}
            <Text style={[styles.playSurahButtonText, { 
              color: isPlayingSurahAudio ? "#ffffff" : '#4CAF50'
            }]}>
              Play Surah
            </Text>
          </Pressable>
        </View>
        
        {/* Action Buttons Row */}
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={[
              styles.actionButton, 
              { 
                borderColor: colors.primary,
                backgroundColor: surahStatus.isMemorized ? colors.primary : 'transparent'
              }
            ]} 
            onPress={handleMarkAllMemorized}
          >
            <CheckCircle size={20} color={surahStatus.isMemorized ? "#ffffff" : colors.primary} />
            <Text
              style={[
                styles.actionButtonText,
                {
                  color: surahStatus.isMemorized ? "#ffffff" : colors.primary
                }
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {surahStatus.isMemorized ? 'Unmark ❌' : 'Mark Memorized'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.actionButton, 
              { 
                borderColor: colors.primary,
                backgroundColor: surahStatus.isRevised ? colors.primary : 'transparent'
              }
            ]} 
            onPress={handleMarkAllRevised}
          >
            <RefreshCw size={20} color={surahStatus.isRevised ? "#ffffff" : colors.primary} />
            <Text
              style={[
                styles.actionButtonText,
                {
                  color: surahStatus.isRevised ? "#ffffff" : colors.primary
                }
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {surahStatus.isRevised ? 'Unmark ❌' : 'Mark Revised'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {isLoading && verses.length === 0 && !loadingError ? (
        <View style={styles.centeredMessage}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading verses...</Text>
        </View>
      ) : loadingError ? (
        <View style={styles.centeredMessage}>
          <Text style={[styles.errorText, { color: colors.warning }]}>{loadingError}</Text>
             <Pressable style={styles.retryButton} onPress={handleRetry}>
            <RefreshCw size={16} color={colors.warning} />
              <Text style={[styles.retryButtonText, { color: colors.warning }]}>Retry Loading</Text>
            </Pressable>
        </View>
      ) : (
        <FlatList
          key={surahId}
          ref={flatListRef}
          data={verses}
          renderItem={renderVerse}
          keyExtractor={(item) => `${surahId}-${item.id}`}
          contentContainerStyle={styles.listContentContainer}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={() => (
            <View style={{ height: 8 }}>
              {/* Minimal spacer only */}
            </View>
          )}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}
      {renderProgressModal()}
    </View>
  );
}