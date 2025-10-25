import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle, Pause, Play, RefreshCw, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

import JuzMemorization from '@/components/JuzMemorization';
import VerseItem from '@/components/VerseItem';
import { surahsData } from '@/data/surahs';
import { fetchVersesForJuz, JuzVerse, logDatabaseTables, fetchVersesForSurah } from '@/services/juzDbService';
import { fetchVersesBySurah } from '@/services/quranApi';
import { fetchTranslationsForVerses } from '@/services/quranApi';
import { useProgressStore } from '@/store/progressStore';
import { useQuranStore } from '@/store/quranStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { Surah } from '@/types';
import { Verse } from '@/types';
import {
  pauseAudio,
  pauseSurahAudio,
  playAudio,
  playSurahAudioWithFallback,
  resumeSurahAudio,
  getAudioUrl,
} from '@/utils/audioUtils';
import { getArabicFontFamily, getArabicTypographySizing } from '@/utils/fontUtils';
import { useThemeColor } from '@/utils/useThemeColor';
import { getAverageVerseHeight } from '@/utils/verseLayoutUtils';

// ============================================================================
// MODULE-LEVEL CONSTANTS & HELPERS
// ============================================================================

const MAX_CACHE_SIZE = 50;
const SURAH_ITEM_HEIGHT = 80;
const BULK_UPDATE_THRESHOLD = 10;

// In-memory cache for verses (scoped by translation language)
const verseCache = new Map<string, Verse[]>();
const surahLoadingState = new Map<
  string,
  { currentPage: number; hasMore: boolean; totalVerses: number }
>();
const loadingLocks = new Map<string, Promise<void>>();
const cacheAccessOrder: string[] = [];

const getCacheKey = (surahId: number, page: number, language: string): string => {
  return `surah_${surahId}_${language}_page_${page}`;
};

const getCachedSurahVerses = (surahId: number, language: string) => {
  let maxPage = 0;
  const verses: Verse[] = [];
  for (const [key, data] of verseCache.entries()) {
    if (key.includes(`surah_${surahId}_${language}`)) {
      verses.push(...data);
      const pageMatch = key.match(/_page_(\d+)$/);
      if (pageMatch) {
        maxPage = Math.max(maxPage, parseInt(pageMatch[1], 10));
      }
    }
  }
  return { verses, maxPage };
};

const getDynamicBatchSize = (surahVerseCount: number, isInitial: boolean): number => {
  if (surahVerseCount < 30) {
    return isInitial ? 5 : 5;
  } else {
    return isInitial ? 10 : 10;
  }
};

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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ReadScreen() {
  const router = useRouter();
  const { primary } = useThemeColor();
  const { fontSizeArabic, fontSizeTranslation, showTranslation, arabicFont } =
    useSettingsStore();
  const arabicTypography = getArabicTypographySizing(fontSizeArabic, arabicFont);
  const arabicFontFamily = getArabicFontFamily(arabicFont);

  // ===== ROUTE PARAMS =====
  const { surahId: paramSurahId, verseId: paramVerseId } = useLocalSearchParams<{
    surahId?: string;
    verseId?: string;
  }>();

  // ===== STATE: Store =====
  const {
    memorizedVerses,
    revisedVerses,
    memorizedVerseDates,
    setLastReadVerse,
    markVerseAsMemorized,
    unmarkVerseAsMemorized,
    markVerseAsRevised,
    unmarkVerseAsRevised,
    bulkMarkVersesMemorized,
    bulkMarkVersesRevised,
  } = useProgressStore();

  // ===== STATE: UI =====
  const [tab, setTab] = useState<'surah' | 'juz'>('surah');
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [selectedJuz, setSelectedJuz] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [verses, setVerses] = useState<Verse[]>([]);
  const [juzVerses, setJuzVerses] = useState<JuzVerse[]>([]);

  // ===== STATE: Loading & Errors =====
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isJuzLoading, setIsJuzLoading] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [juzLoadingError, setJuzLoadingError] = useState<string | null>(null);

  // ===== STATE: Pagination =====
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreVerses, setHasMoreVerses] = useState(true);
  const [totalVersesInSurah, setTotalVersesInSurah] = useState(0);

  // ===== STATE: Audio =====
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPlayingSurah, setIsPlayingSurah] = useState(false);
  const [isSurahPaused, setIsSurahPaused] = useState(false);

  // ===== STATE: Progress Modal =====
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [progressAction, setProgressAction] = useState<string | null>(null);
  const [progressCount, setProgressCount] = useState(0);

  // ===== STATE: Settings =====
  const { translationLanguage } = useSettingsStore();
  const lastViewedSurahId = useQuranStore((state) => state.lastViewedSurahId);
  const setLastViewedSurahId = useQuranStore((state) => state.setLastViewedSurahId);

  // ===== REFS =====
  const surahListRef = useRef<FlatList>(null);
  const versesListRef = useRef<FlatList<Verse>>(null);
  const versesRef = useRef<Verse[]>([]);
  const targetVerseRef = useRef<number | null>(null);
  const scrollOffsetRef = useRef(0);
  const isNavigatingBack = useRef(false);
  const suppressNextAutoOpen = useRef(false);

  // ===== MEMOIZED VALUES =====
  const filteredSurahs = useMemo(() => {
    return searchQuery.trim() === ''
      ? surahsData
      : surahsData.filter((surah: Surah) =>
          surah.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
        );
  }, [searchQuery]);

  // Cache the average verse height calculation
  const averageVerseHeight = useMemo(() => {
    // Only calculate if we have verses
    if (!verses.length) return 200; // Default height when no verses
    
    return getAverageVerseHeight(verses.slice(0, 10), { // Sample first 10 verses for better performance
      arabicFontSize: fontSizeArabic,
      showTranslation: showTranslation,
      translationFontSize: fontSizeTranslation,
    });
    // Only recalculate when these specific dependencies change
  }, [
    // Only include dependencies that actually affect the calculation
    fontSizeArabic,
    showTranslation,
    fontSizeTranslation,
    // Add a dependency on the verses length to handle initial load
    // but use a stable reference to the current verses length
    verses.length > 0 ? verses[0]?.id : 0, // Use first verse id as a stable reference
    verses.length // Include length to handle empty state changes
  ]);

  const getSurahVerseRange = useCallback((surahObj: { id: number; versesCount: number }) => {
    let startVerseId = 0;
    for (let i = 1; i < surahObj.id; i++) {
      const prevSurah = surahsData.find((s) => s.id === i);
      if (prevSurah) startVerseId += prevSurah.versesCount;
    }
    const verseIds: number[] = [];
    for (let i = 1; i <= surahObj.versesCount; i++) {
      verseIds.push(startVerseId + i);
    }
    return verseIds;
  }, []);

  const calculateSurahProgress = useCallback(
    (surahId: number) => {
      let startVerseId = 0;
      for (let i = 1; i < surahId; i++) {
        const prevSurah = surahsData.find((s) => s.id === i);
        if (prevSurah) startVerseId += prevSurah.versesCount;
      }
      const surah = surahsData.find((s) => s.id === surahId);
      if (!surah) return { memorized: 0, progress: 0 };
      const startVerse = startVerseId + 1;
      const endVerse = startVerseId + surah.versesCount;
      const memorizedInSurah = memorizedVerses.filter(
        (id: number) => id >= startVerse && id <= endVerse
      ).length;
      const progressPercentage = (memorizedInSurah / surah.versesCount) * 100;
      return { memorized: memorizedInSurah, progress: progressPercentage };
    },
    [memorizedVerses]
  );

  const surahStatus = useMemo(() => {
    if (!selectedSurah) return { isMemorized: false, isRevised: false };
    const allVerseIds = getSurahVerseRange({
      id: selectedSurah.id,
      versesCount: selectedSurah.versesCount,
    });
    const memorizedSet = new Set(memorizedVerses);
    const revisedSet = new Set(revisedVerses.map((v: any) => v.verseId));
    const isMemorized = allVerseIds.every((id: number) => memorizedSet.has(id));
    const isRevised = allVerseIds.every((id: number) => revisedSet.has(id));
    return { isMemorized, isRevised };
  }, [selectedSurah, memorizedVerses, revisedVerses, getSurahVerseRange]);

  const isSurahMemorizedGlobally = useMemo(() => {
    if (!selectedSurah) return false;
    const allIds = getSurahVerseRange({
      id: selectedSurah.id,
      versesCount: selectedSurah.versesCount,
    });
    return allIds.length > 0 && allIds.every((id) => memorizedVerses.includes(id));
  }, [selectedSurah, memorizedVerses, getSurahVerseRange]);

  const isSurahRevisedGlobally = useMemo(() => {
    if (!selectedSurah) return false;
    const allIds = getSurahVerseRange({
      id: selectedSurah.id,
      versesCount: selectedSurah.versesCount,
    });
    return allIds.length > 0 && allIds.every((id) => revisedVerses.some((rv) => rv.verseId === id));
  }, [selectedSurah, revisedVerses, getSurahVerseRange]);

  // ===== CALLBACKS =====
  const clearError = useCallback(() => {
    setLoadingError(null);
  }, []);

  const getProgressColor = (progress: number): string => {
    if (progress === 0) return '#666666';
    if (progress === 100) return '#4CAF50';
    return '#FF9800';
  };

  const formatDate = (date: Date): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = date.getDate();
    const m = months[date.getMonth()];
    const y = date.getFullYear();
    return `${d} ${m} ${y}`;
  };

  const getSurahCompletionDate = (surahId: number): Date | null => {
    const surah = surahsData.find((s) => s.id === surahId);
    if (!surah) return null;
    const allIds = getSurahVerseRange({ id: surah.id, versesCount: surah.versesCount });
    const memSet = new Set(memorizedVerses);
    const isFull = allIds.every((id) => memSet.has(id));
    if (!isFull) return null;
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

  const clearSurahCache = useCallback((surahId: number, language: string) => {
    const cacheKey = `surah_${surahId}_${language}_page_`;
    for (const [key] of verseCache.entries()) {
      if (key.startsWith(cacheKey)) {
        verseCache.delete(key);
      }
    }
  }, []);

  // ===== ASYNC LOADERS =====
  const loadInitialVerses = useCallback(
    async (surah: any) => {
      const lockKey = `surah_${surah.id}_${translationLanguage}`;
      if (loadingLocks.has(lockKey)) return loadingLocks.get(lockKey);

      const loadPromise = (async () => {
        setIsLoading(true);
        setLoadingError(null);
        clearError();
        setTotalVersesInSurah(surah.versesCount);

        try {
          console.log(`Loading initial verses for surah ${surah.id} (${surah.name})`);

          const cachedData = getCachedSurahVerses(surah.id, translationLanguage);
          const savedState = surahLoadingState.get(`surah_${surah.id}_${translationLanguage}`);

          if (cachedData.verses.length > 0) {
            console.log(`Found ${cachedData.verses.length} cached verses for surah ${surah.id}`);
            setVerses(cachedData.verses);
            setLastReadVerse(cachedData.verses[0]);

            if (savedState) {
              setCurrentPage(savedState.currentPage);
              setHasMoreVerses(savedState.hasMore);
            } else {
              setCurrentPage(cachedData.maxPage);
              setHasMoreVerses(cachedData.verses.length < surah.versesCount);
            }
          } else {
            setCurrentPage(1);
            setHasMoreVerses(true);

            // Load full surah from local DB (same approach as Juz)
            try {
              const allVersesFromDB = await fetchVersesForSurah(surah.id);

              // Map DB rows to Verse shape and attach audioUrl from settings
              const reciterIdentifier = useSettingsStore.getState().reciterIdentifier;
              let mappedVerses: Verse[] = allVersesFromDB.map((v) => ({
                id: v.verse_id,
                surahId: v.chapter_id,
                verseNumber: v.verse_number,
                arabicText: v.ayah,
                translation: v.translation || '',
                transliteration: v.transliteration || undefined,
                pageNumber: v.page_id ? Number(v.page_id) : undefined,
                juzNumber: v.part_id ? Number(v.part_id) : undefined,
                audioUrl: getAudioUrl(reciterIdentifier, v.chapter_id || surah.id, v.verse_number),
              }));

              // If non-English translation is selected, fetch translations from API and merge
              const langBase = (translationLanguage.split('.')[0] || 'en').toLowerCase();
              if (langBase !== 'en') {
                const translations = await fetchTranslationsForVerses(surah.id, mappedVerses.map((m: any) => ({ verse_number: m.verseNumber })), translationLanguage);
                mappedVerses = mappedVerses.map((mv, idx) => ({ ...mv, translation: translations[idx] || mv.translation || '' }));
              }

              // Store full surah in an in-memory cache and display first batch
              const batchSize = getDynamicBatchSize(surah.versesCount, true);
              setCacheWithLimit(getCacheKey(surah.id, 1, translationLanguage), mappedVerses.slice(0, batchSize));
              setVerses(mappedVerses.slice(0, batchSize));
              setLastReadVerse(mappedVerses[0]);
              setHasMoreVerses(mappedVerses.length > batchSize);

              surahLoadingState.set(`surah_${surah.id}_${translationLanguage}`, {
                currentPage: 1,
                hasMore: mappedVerses.length > batchSize,
                totalVerses: mappedVerses.length,
              });

              // Keep full verses in a ref for subsequent paging
              (versesRef as any).currentFullSurah = mappedVerses;
            } catch (err) {
              console.error('Failed to load surah from local DB:', err);
              setLoadingError(`Failed to load verses for ${surah.name}. ${err instanceof Error ? err.message : ''}`);
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
      try {
        await loadPromise;
      } finally {
        loadingLocks.delete(lockKey);
      }
      return loadPromise;
    },
    [clearError, setLastReadVerse, translationLanguage]
  );

  const loadMoreVerses = useCallback(async (): Promise<Verse[]> => {
    if (!selectedSurah || isLoadingMore || !hasMoreVerses) return versesRef.current || [];

    setIsLoadingMore(true);
    const nextPage = currentPage + 1;

    try {
      console.log(`Loading more verses for surah ${selectedSurah.id}, page ${nextPage}`);

      const cacheKey = getCacheKey(selectedSurah.id, nextPage, translationLanguage);
      let fetchedVerses: Verse[] = [];

      if (verseCache.has(cacheKey)) {
        fetchedVerses = verseCache.get(cacheKey)!;
        touchCacheKey(cacheKey);
        console.log(`Using cached page ${nextPage} for surah ${selectedSurah.id}`);
      } else {
        // Prefer local DB full surah if loaded
        const fullSurah: Verse[] | undefined = (versesRef as any).currentFullSurah;
        if (fullSurah && Array.isArray(fullSurah) && fullSurah.length > 0) {
          const pageSize = getDynamicBatchSize(selectedSurah.versesCount, false);
          const startIdx = (nextPage - 1) * pageSize;
          const pageSlice = fullSurah.slice(startIdx, startIdx + pageSize);
          fetchedVerses = pageSlice;
          if (fetchedVerses.length > 0) setCacheWithLimit(cacheKey, fetchedVerses);
        } else {
          const result = await fetchVersesBySurah(
            selectedSurah.id,
            nextPage,
            getDynamicBatchSize(selectedSurah.versesCount, false),
            translationLanguage
          );
          fetchedVerses = result.verses;

          if (fetchedVerses.length > 0) {
            setCacheWithLimit(cacheKey, fetchedVerses);
          }
        }
      }

      if (fetchedVerses.length > 0) {
        let updatedVerses: Verse[] = [];
        setVerses((prev) => {
          const existingIds = new Set(prev.map((v) => v.id));
          const newVerses = fetchedVerses.filter((v) => !existingIds.has(v.id));
          updatedVerses = [...prev, ...newVerses];
          versesRef.current = updatedVerses;
          return updatedVerses;
        });

        setCurrentPage(nextPage);
        const newTotal = versesRef.current?.length || 0;
        const stillHasMore = newTotal < totalVersesInSurah;
        setHasMoreVerses(stillHasMore);

        surahLoadingState.set(`surah_${selectedSurah.id}_${translationLanguage}`, {
          currentPage: nextPage,
          hasMore: stillHasMore,
          totalVerses: totalVersesInSurah,
        });

        return updatedVerses;
      } else {
        setHasMoreVerses(false);
        return versesRef.current || [];
      }
    } catch (err) {
      console.error('Failed to load more verses:', err);
      setHasMoreVerses(false);
      return versesRef.current || [];
    } finally {
      setIsLoadingMore(false);
    }
  }, [selectedSurah, currentPage, isLoadingMore, hasMoreVerses, totalVersesInSurah, translationLanguage]);

  const handleSelectJuz = async (juz: number) => {
    setSelectedJuz(juz);
    setIsJuzLoading(true);
    setJuzLoadingError(null);

    try {
      const versesData = await fetchVersesForJuz(juz);
      setJuzVerses(versesData);
    } catch (err) {
      console.error(`Failed to load juz ${juz}:`, err);
      setJuzLoadingError(`Failed to load Juz ${juz}. Please try again.`);
    } finally {
      setIsJuzLoading(false);
    }
  };

  const handleBackToJuzList = () => {
    setSelectedJuz(null);
    setJuzVerses([]);
  };

  const handleSurahPress = (surah: any) => {
    surahListRef.current?.getScrollableNode?.()?.scrollTop &&
      (scrollOffsetRef.current = surahListRef.current.getScrollableNode().scrollTop || 0);

    setSelectedSurah(surah);
    setLastViewedSurahId(surah.id);
    loadInitialVerses(surah);
  };

  const handleBackToSurahs = useCallback(() => {
    if (isNavigatingBack.current) return;
    isNavigatingBack.current = true;

    try {
      if (paramSurahId) {
        if (selectedSurah) {
          suppressNextAutoOpen.current = true;
          setSelectedSurah(null);
          setVerses([]);
          setLoadingError(null);
          setCurrentPage(1);
          setHasMoreVerses(true);
          try {
            router.replace('/(tabs)/read');
          } catch {}

          setTimeout(() => {
            suppressNextAutoOpen.current = false;
          }, 700);

          setTimeout(() => {
            if (surahListRef.current) {
              surahListRef.current.scrollToOffset({
                offset: scrollOffsetRef.current || 0,
                animated: false,
              });
            }
            isNavigatingBack.current = false;
          }, 50);
          return;
        } else {
          try {
            router.back();
          } catch {
            try {
              router.replace('/');
            } catch {}
          }
          setTimeout(() => {
            isNavigatingBack.current = false;
          }, 500);
          return;
        }
      }

      if (selectedSurah) {
        suppressNextAutoOpen.current = true;
        setSelectedSurah(null);
        setVerses([]);
        setLoadingError(null);
        setCurrentPage(1);
        setHasMoreVerses(true);
        try {
          router.replace('/(tabs)/read');
        } catch {}

        setTimeout(() => {
          if (surahListRef.current) {
            surahListRef.current.scrollToOffset({
              offset: scrollOffsetRef.current || 0,
              animated: false,
            });
          }
          isNavigatingBack.current = false;
        }, 50);
      } else {
        try {
          router.replace('/');
        } catch {
          router.push('/');
        }
        setTimeout(() => {
          isNavigatingBack.current = false;
        }, 300);
      }
    } catch (e) {
      console.error('[read] handleBackToSurahs error', e);
      isNavigatingBack.current = false;
    }
  }, [selectedSurah, router, paramSurahId]);

  const handleVerseMemorizeToggle = useCallback(
    (verseId: number) => {
      if (memorizedVerses.includes(verseId)) {
        unmarkVerseAsMemorized(verseId);
      } else {
        markVerseAsMemorized(verseId);
      }
    },
    [memorizedVerses, unmarkVerseAsMemorized, markVerseAsMemorized]
  );

  const handleVerseRevisionToggle = useCallback(
    (verseId: number) => {
      const isRevised = revisedVerses.some((rv) => rv.verseId === verseId);
      if (isRevised) {
        unmarkVerseAsRevised(verseId);
      } else {
        markVerseAsRevised(verseId);
      }
    },
    [revisedVerses, markVerseAsRevised, unmarkVerseAsRevised]
  );

  // VerseItem expects onPlayAudio(surahNum, verseNum, globalId?, repeats?, isInfinite?) => void
  const handleVersePlayAudio = useCallback(
    async (surahNum: number, verseNum: number, _globalId?: number, repeats?: number, isInfinite?: boolean) => {
      try {
        // Try to find verse object in current verses; fallback to constructing URL
        const verse = versesRef.current?.find((v) => v.surahId === surahNum && v.verseNumber === verseNum);
        const reciterIdentifier = useSettingsStore.getState().reciterIdentifier;
        const url = (verse && (verse as any).audioUrl) || getAudioUrl(reciterIdentifier, surahNum, verseNum);

        const repeatCountToUse = typeof repeats === 'number' ? repeats : 1;
        const infinite = !!isInfinite;

        if (isPlayingAudio) {
          await pauseAudio();
          setIsPlayingAudio(false);
        } else {
          await playAudio(url, repeatCountToUse, (status) => {
            // propagate minimal status if needed
            if (status?.isPlaying) setIsPlayingAudio(true);
            if (status?.didJustFinish && !infinite && (status.repeatCount ?? 0) >= (status.maxRepeats ?? 1)) {
              setIsPlayingAudio(false);
            }
          });
          setIsPlayingAudio(true);
        }
      } catch (e) {
        console.error('Audio playback failed:', e);
      }
    },
    [isPlayingAudio]
  );

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

      if (isSurahPaused) {
        console.log('Currently paused - resuming surah audio');
        await resumeSurahAudio();
        setIsPlayingSurah(true);
        setIsSurahPaused(false);
        return;
      }

      console.log('Starting new surah audio playback for surah:', selectedSurah.id);

      await playSurahAudioWithFallback(selectedSurah.id, 1, (status: any) => {
        console.log('Surah audio status update:', status);

        if (status?.didJustFinish) {
          console.log('Surah playback finished');
          setIsPlayingSurah(false);
          setIsSurahPaused(false);
          return;
        }

        if (status?.isPlaying === true) {
          console.log('Surah playback started/resumed');
          setIsPlayingSurah(true);
          setIsSurahPaused(false);
          return;
        }

        if (status?.isPaused === true && status?.isPlaying === false) {
          console.log('Surah playback paused');
          setIsPlayingSurah(false);
          setIsSurahPaused(true);
          return;
        }

        if (status?.error) {
          console.error('Surah playback error:', status.error);
          setIsPlayingSurah(false);
          setIsSurahPaused(false);
        }

        if (status?.fallbackUsed) {
          console.log('Using fallback reciter for surah audio');
        }
      });

      setIsPlayingSurah(true);
      setIsSurahPaused(false);
      console.log('Surah audio started successfully');
    } catch (e) {
      console.error('Surah audio playback failed:', e);
      setIsPlayingSurah(false);
      setIsSurahPaused(false);
    }
  }, [selectedSurah, isPlayingSurah, isSurahPaused]);

  const handleSurahMemorizeToggle = useCallback(async () => {
    if (!selectedSurah) return;
    const surahVerseIds = getSurahVerseRange({
      id: selectedSurah.id,
      versesCount: selectedSurah.versesCount,
    });
    const isCurrentlyMemorized = isSurahMemorizedGlobally;
    try {
      if (isCurrentlyMemorized) {
        await bulkMarkVersesMemorized(surahVerseIds, false);
        surahVerseIds.forEach((id) => {
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
    const surahVerseIds = getSurahVerseRange({
      id: selectedSurah.id,
      versesCount: selectedSurah.versesCount,
    });
    const isCurrentlyRevised = isSurahRevisedGlobally;
    try {
      if (isCurrentlyRevised) {
        surahVerseIds.forEach((verseId) => {
          unmarkVerseAsRevised(verseId);
        });
      } else {
        await bulkMarkVersesRevised(surahVerseIds);
      }
    } catch (error) {
      console.error('Failed to toggle surah revision:', error);
      Alert.alert('Error', 'Failed to update revision status. Please try again.');
    }
  }, [selectedSurah, isSurahRevisedGlobally, bulkMarkVersesRevised, unmarkVerseAsRevised, getSurahVerseRange]);

  const handleMarkAllMemorized = async () => {
    if (!selectedSurah) return;

    const allSurahVerseIds = getSurahVerseRange(selectedSurah);
    const memorizedSet = new Set(memorizedVerses);
    const isMarking = !surahStatus.isMemorized;

    const versesToUpdate = allSurahVerseIds.filter((verseId) => {
      if (isMarking) {
        return !memorizedSet.has(verseId);
      } else {
        return memorizedSet.has(verseId);
      }
    });

    if (versesToUpdate.length === 0) {
      Alert.alert('No Changes', 'All verses are already in the desired state.');
      return;
    }

    setProgressAction(isMarking ? 'mark-memorized' : 'unmark-memorized');
    setProgressModalVisible(true);
    setProgressCount(0);

    try {
      const startTime = Date.now();

      if (selectedSurah.versesCount >= BULK_UPDATE_THRESHOLD) {
        console.log(
          `Using bulk update for ${selectedSurah.name} (${versesToUpdate.length} verses)`
        );

        await bulkMarkVersesMemorized(versesToUpdate, isMarking);

        const BATCH_SIZE = 50;
        for (let i = 0; i < versesToUpdate.length; i += BATCH_SIZE) {
          const batch = versesToUpdate.slice(i, i + BATCH_SIZE);

          if (isMarking) {
            useProgressStore.setState((state) => {
              const existingSet = new Set(state.memorizedVerses);
              const newVerses = batch.filter((id) => !existingSet.has(id));
              return {
                memorizedVerses: [...state.memorizedVerses, ...newVerses],
              };
            });
          } else {
            useProgressStore.setState((state) => ({
              memorizedVerses: state.memorizedVerses.filter((id) => !batch.includes(id)),
            }));
          }

          setProgressCount(Math.min(i + BATCH_SIZE, versesToUpdate.length));
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      } else {
        console.log(
          `Using individual updates for ${selectedSurah.name} (${versesToUpdate.length} verses)`
        );

        const BATCH_SIZE = 10;
        let processed = 0;

        for (let i = 0; i < versesToUpdate.length; i += BATCH_SIZE) {
          const batch = versesToUpdate.slice(i, i + BATCH_SIZE);

          await Promise.all(
            batch.map(async (verseId) => {
              try {
                if (isMarking) {
                  markVerseAsMemorized(verseId);
                } else {
                  unmarkVerseAsMemorized(verseId);
                }
              } catch (e) {
                console.error('Verse update failed:', e);
              }
            })
          );

          processed += batch.length;
          setProgressCount(processed);

          if (i + BATCH_SIZE < versesToUpdate.length) {
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(
        `✅ Successfully updated ${versesToUpdate.length} verses for ${selectedSurah.name} in ${duration}ms`
      );
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

    const versesToUpdate = allSurahVerseIds.filter((verseId) => {
      if (isMarking) {
        return !revisedSet.has(verseId);
      } else {
        return revisedSet.has(verseId);
      }
    });

    if (versesToUpdate.length === 0) {
      Alert.alert('No Changes', 'All verses are already in the desired state.');
      return;
    }

    setProgressAction(isMarking ? 'mark-revised' : 'unmark-revised');
    setProgressModalVisible(true);
    setProgressCount(0);

    try {
      const startTime = Date.now();

      if (selectedSurah.versesCount >= BULK_UPDATE_THRESHOLD) {
        console.log(
          `Using bulk revision update for ${selectedSurah.name} (${versesToUpdate.length} verses)`
        );

        if (isMarking) {
          const { bulkLogRevisions } = await import('@/assets/database/QuranDatabase');
          await bulkLogRevisions(versesToUpdate);
        }

        const BATCH_SIZE = 50;
        for (let i = 0; i < versesToUpdate.length; i += BATCH_SIZE) {
          const batch = versesToUpdate.slice(i, i + BATCH_SIZE);

          if (isMarking) {
            batch.forEach((verseId) => {
              useProgressStore.setState((state) => {
                const exists = state.revisedVerses.some((rv) => rv.verseId === verseId);
                if (!exists) {
                  const now = new Date();
                  const today = now.toISOString().split('T')[0];
                  return {
                    revisedVerses: [
                      ...state.revisedVerses,
                      { verseId, revisionDate: today },
                    ],
                    dailyRevisedVerses: [...state.dailyRevisedVerses, { verseId, date: today }],
                    weeklyRevisedVerses: [...state.weeklyRevisedVerses, { verseId, date: today }],
                  };
                }
                return state;
              });
            });
          } else {
            useProgressStore.setState((state) => ({
              revisedVerses: state.revisedVerses.filter((rv) => !batch.includes(rv.verseId)),
              dailyRevisedVerses: state.dailyRevisedVerses.filter(
                (rv) => !batch.includes(rv.verseId)
              ),
              weeklyRevisedVerses: state.weeklyRevisedVerses.filter(
                (rv) => !batch.includes(rv.verseId)
              ),
            }));
          }

          setProgressCount(Math.min(i + BATCH_SIZE, versesToUpdate.length));
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      } else {
        console.log(
          `Using individual revision updates for ${selectedSurah.name} (${versesToUpdate.length} verses)`
        );

        const BATCH_SIZE = 10;
        let processed = 0;

        for (let i = 0; i < versesToUpdate.length; i += BATCH_SIZE) {
          const batch = versesToUpdate.slice(i, i + BATCH_SIZE);

          await Promise.all(
            batch.map(async (verseId) => {
              try {
                if (isMarking) {
                  markVerseAsRevised(verseId);
                } else {
                  useProgressStore.setState((state) => ({
                    revisedVerses: state.revisedVerses.filter((rv) => rv.verseId !== verseId),
                    dailyRevisedVerses: state.dailyRevisedVerses.filter(
                      (rv) => rv.verseId !== verseId
                    ),
                    weeklyRevisedVerses: state.weeklyRevisedVerses.filter(
                      (rv) => rv.verseId !== verseId
                    ),
                  }));
                }
              } catch (e) {
                console.error('Verse revision update failed:', e);
              }
            })
          );

          processed += batch.length;
          setProgressCount(processed);

          if (i + BATCH_SIZE < versesToUpdate.length) {
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(
        `✅ Successfully updated ${versesToUpdate.length} verse revisions for ${selectedSurah.name} in ${duration}ms`
      );
    } catch (error) {
      console.error('Failed to update verse revisions:', error);
      Alert.alert('Error', 'Failed to update verse revisions. Please try again.');
    } finally {
      setProgressModalVisible(false);
      setProgressAction(null);
    }
  };

  // ===== RENDER HELPERS =====
  const renderVerseOptimized = useCallback(
    ({ item: verse }: { item: Verse }) => (
      <VerseItem
        verse={verse}
        onPlayAudio={(s, v, gid, repeats, isInfinite) => handleVersePlayAudio(s, v, gid, repeats, isInfinite)}
        surahMemorizedGlobally={isSurahMemorizedGlobally}
        surahRevisedGlobally={isSurahRevisedGlobally}
        onSurahMemorizeToggle={handleSurahMemorizeToggle}
        onSurahRevisionToggle={handleSurahRevisionToggle}
      />
    ),
    [
      handleVersePlayAudio,
      isSurahMemorizedGlobally,
      isSurahRevisedGlobally,
      handleSurahMemorizeToggle,
      handleSurahRevisionToggle,
    ]
  );

  const renderSurahItem = ({ item }: { item: Surah }) => {
    const surahProgress = calculateSurahProgress(item.id);
    const progressColor = getProgressColor(surahProgress.progress);
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
          },
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
            <Text style={[styles.surahDetails, { color: '#888888' }]}>
              {item.versesCount} verses • <Text style={{ color: '#4CAF50' }}>{revelationDisplay}</Text>
            </Text>
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
        <Text style={[styles.loadingMoreText, { color: '#888888' }]}>Loading more verses...</Text>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: '#888888' }]}>No verses found</Text>
    </View>
  );

  const renderProgressModal = () => (
    <Modal transparent visible={progressModalVisible} animationType="fade">
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            backgroundColor: '#222',
            borderRadius: 12,
            padding: 24,
            alignItems: 'center',
            width: '80%',
          }}
        >
          <Text style={{ color: '#FFD700', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            {progressAction === 'mark-memorized' && 'Marking Memorized...'}
            {progressAction === 'unmark-memorized' && 'Unmarking Memorized...'}
            {progressAction === 'mark-revised' && 'Marking Revised...'}
            {progressAction === 'unmark-revised' && 'Unmarking Revised...'}
          </Text>
          <View
            style={{
              width: 180,
              height: 8,
              backgroundColor: '#333',
              borderRadius: 4,
              overflow: 'hidden',
              marginVertical: 16,
            }}
          >
            <View
              style={{
                width: `${Math.max(5, Math.round((progressCount / (selectedSurah?.versesCount || 1)) * 100))}%`,
                height: '100%',
                backgroundColor: primary,
                borderRadius: 4,
              }}
            />
          </View>
          <Text style={{ color: '#aaa', fontSize: 14 }}>
            {progressCount} / {selectedSurah?.versesCount || 0} verses
          </Text>
          <Text style={{ color: '#888', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
            Please wait while the update completes. Navigation is disabled during this process.
          </Text>
        </View>
      </View>
    </Modal>
  );

  // ===== EFFECTS =====
  useEffect(() => {
    versesRef.current = verses;
  }, [verses]);

  useEffect(() => {
    if (lastViewedSurahId && !selectedSurah) {
      if (suppressNextAutoOpen.current) {
        return;
      }
      const surah = surahsData.find((s) => s.id === lastViewedSurahId);
      if (surah) {
        setSelectedSurah(surah);
        loadInitialVerses(surah);
      }
    }
  }, [lastViewedSurahId, selectedSurah, loadInitialVerses]);

  useEffect(() => {
    if (selectedSurah) {
      setVerses([]);
      setCurrentPage(1);
      setHasMoreVerses(true);
      loadInitialVerses(selectedSurah);
    }
  }, [translationLanguage, selectedSurah, loadInitialVerses]);

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
    const hasTajweedText = hasVerses && verses.every((v: any) => !!(v as any).tajweedText);
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

  useEffect(() => {
    const sid = paramSurahId ? Number(paramSurahId) : undefined;
    const vid = paramVerseId ? Number(paramVerseId) : undefined;
    if (sid && !Number.isNaN(sid)) {
      const surah = surahsData.find((s) => s.id === sid);
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

  useFocusEffect(
    useCallback(() => {
      const sid = paramSurahId ? Number(paramSurahId) : undefined;
      const vid = paramVerseId ? Number(paramVerseId) : undefined;
      if (sid && !Number.isNaN(sid)) {
        if ((!selectedSurah || selectedSurah.id !== sid) && !suppressNextAutoOpen.current) {
          const surah = surahsData.find((s) => s.id === sid);
          if (surah) {
            setSelectedSurah(surah);
            setLastViewedSurahId(surah.id);
            if (vid && !Number.isNaN(vid)) targetVerseRef.current = vid;
            loadInitialVerses(surah);
          }
        }
      }
      return () => {};
    }, [paramSurahId, paramVerseId, selectedSurah, loadInitialVerses, setLastViewedSurahId])
  );

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sid = paramSurahId ? Number(paramSurahId) : undefined;
    if (!sid) return;
    if (selectedSurah && selectedSurah.id === sid) return;
    const timeout = setTimeout(() => {
      if (!selectedSurah && !suppressNextAutoOpen.current) {
        const surah = surahsData.find((s) => s.id === sid);
        if (surah) {
          console.log('[read] Fallback re-open surah due to initial miss (Android)', sid);
          setSelectedSurah(surah);
          setLastViewedSurahId(surah.id);
          loadInitialVerses(surah);
        }
      }
    }, 180);
    return () => clearTimeout(timeout);
  }, [paramSurahId, selectedSurah, loadInitialVerses, setLastViewedSurahId]);

  useEffect(() => {
    if (!selectedSurah) return;
    (async () => {
      try {
        await pauseSurahAudio();
      } catch {}
      setIsPlayingSurah(false);
      setIsSurahPaused(false);
    })();
  }, [selectedSurah?.id]);

  useEffect(() => {
    // Automatically log all tables in the DB for diagnostics
    logDatabaseTables();
  }, []);

  // ===== MAIN RENDER =====
  return (
    <View style={[styles.container, { backgroundColor: '#1a1a1a' }]}>
      {renderProgressModal()}

      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={handleBackToSurahs} style={{ marginRight: 12 }}>
            <ArrowLeft size={28} color="#FFD700" />
          </TouchableOpacity>
          {selectedSurah ? (
            <View style={[styles.headerTitleContainer, { alignItems: 'center' }]}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 4,
                }}
              >
                <Text style={styles.headerTitle}>{`${selectedSurah.id}. ${selectedSurah.englishName}`}</Text>
                <TouchableOpacity
                  onPress={handleToggleSurahAudio}
                  style={{
                    marginLeft: 10,
                    backgroundColor: isPlayingSurah ? '#FFD700' : '#333333',
                    borderRadius: 22,
                    width: 42,
                    height: 42,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: isPlayingSurah ? '#FFD700' : '#555555',
                    shadowColor: '#000',
                    shadowOpacity: 0.3,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 2 },
                  }}
                  activeOpacity={0.8}
                >
                  {isPlayingSurah ? (
                    <Pause size={22} color="#1a1a1a" />
                  ) : (
                    <Play size={22} color="#FFD700" />
                  )}
                </TouchableOpacity>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  paddingHorizontal: 8,
                  marginTop: 6,
                }}
              >
                <View style={{ flex: 0.25, alignItems: 'flex-start' }}>
                  <Text
                    style={{
                      color: '#ffffff',
                      backgroundColor: '#444',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      overflow: 'hidden',
                      marginRight: 8,
                      fontSize: 12,
                    }}
                  >
                    {selectedSurah.revelationType === 'Medinan' ? 'Madani' : 'Makki'}
                  </Text>
                </View>
                <View style={{ flex: 0.5, alignItems: 'center' }}>
                  <Text
                    style={[
                      styles.headerSubtitle,
                      {
                        fontFamily: arabicFontFamily,
                        ...arabicTypography,
                        textAlign: 'center',
                        color: '#ffffff',
                      },
                    ]}
                  >
                    {selectedSurah.arabicName}
                  </Text>
                </View>
                <View style={{ flex: 0.25, alignItems: 'flex-end' }}>
                  <Text style={{ color: '#ffffff', fontSize: 12 }}>{selectedSurah.versesCount} verses</Text>
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

      {/* Tabs & Search */}
      {!selectedSurah && (
        <View style={[styles.searchBarContainer, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}> 
          <View style={[styles.searchInputWrapper, { flex: 1, marginRight: 12 }]}> 
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

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => { setSelectedJuz(null); setTab('surah'); }}
              style={[
                styles.tabButton,
                { width: 72, alignItems: 'center' },
                tab === 'surah' && { backgroundColor: primary },
              ]}
            >
              <Text style={[styles.tabText, tab === 'surah' && styles.tabTextActive]}>Surah</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setSelectedJuz(null); setTab('juz'); }}
              style={[
                styles.tabButton,
                { width: 72, alignItems: 'center' },
                tab === 'juz' && { backgroundColor: primary },
              ]}
            >
              <Text style={[styles.tabText, tab === 'juz' && styles.tabTextActive]}>Juz</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Content */}
      <View style={[styles.container, { backgroundColor: '#1a1a1a' }]}>
        {selectedSurah ? (
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
                getItemLayout={(data, index) => ({
                  length: averageVerseHeight,
                  offset: averageVerseHeight * index,
                  index,
                })}
                onScrollToIndexFailed={(info) => {
                  console.warn('[read] onScrollToIndexFailed', info);
                  const avg = info.averageItemLength || averageVerseHeight || 200;
                  const offset = Math.max(0, Math.round(info.index * avg));
                  setTimeout(() => {
                    try {
                      versesListRef.current?.scrollToOffset({ offset, animated: true });
                    } catch (e) {
                      console.warn('[read] scrollToOffset failed in handler', e);
                    }
                  }, 120);
                }}
              />
            )}
          </View>
        ) : selectedJuz != null ? (
          // --- Selected Juz view (rendered inline so app chrome remains visible) ---
          <View style={[styles.versesContainer, { backgroundColor: '#1a1a1a' }]}> 
            {isJuzLoading ? (
              <View style={[styles.loadingContainer, { backgroundColor: '#1a1a1a' }]}>
                <ActivityIndicator size="large" color={primary} />
                <Text style={[styles.loadingText, { color: '#ffffff' }]}>Loading verses...</Text>
              </View>
            ) : juzLoadingError ? (
              <View style={[styles.errorContainer, { backgroundColor: '#1a1a1a' }]}>
                <Text style={[styles.errorText, { color: '#ff5252' }]}>{juzLoadingError}</Text>
                <Pressable
                  style={[styles.retryButton, { backgroundColor: primary }]}
                  onPress={() => handleSelectJuz(selectedJuz)}
                >
                  <Text style={[styles.retryButtonText, { color: '#ffffff' }]}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                data={juzVerses}
                keyExtractor={(item: any, index) => `jz-${item.verse_id ?? index}-${index}`}
                renderItem={({ item }) => (
                  <VerseItem
                    verse={{
                      id: item.verse_id,
                      surahId: item.chapter_id,
                      verseNumber: item.verse_number,
                      arabicText: item.ayah,
                      translation: item.translation || '',
                      transliteration: item.transliteration || undefined,
                      pageNumber: item.page_id ? Number(item.page_id) : undefined,
                      juzNumber: item.part_id ? Number(item.part_id) : undefined,
                    }}
                    onPlayAudio={(s, v, gid, repeats, isInfinite) => handleVersePlayAudio(s, v, gid, repeats, isInfinite)}
                    surahMemorizedGlobally={false}
                    surahRevisedGlobally={false}
                    onSurahMemorizeToggle={() => {}}
                    onSurahRevisionToggle={() => {}}
                  />
                )}
                contentContainerStyle={[styles.versesContent, { backgroundColor: '#1a1a1a' }]}
                showsVerticalScrollIndicator={true}
                removeClippedSubviews={true}
                maxToRenderPerBatch={8}
                windowSize={10}
                initialNumToRender={8}
              />
            )}
          </View>
        ) : tab === 'surah' ? (
          <FlatList
            ref={surahListRef}
            data={filteredSurahs}
            renderItem={renderSurahItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={[styles.surahListContent, { backgroundColor: '#1a1a1a' }]}
            style={{ backgroundColor: '#1a1a1a' }}
            onScroll={(e) => {
              scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={400}
            getItemLayout={(data, index) => ({
              length: SURAH_ITEM_HEIGHT,
              offset: SURAH_ITEM_HEIGHT * index,
              index,
            })}
            initialNumToRender={12}
            windowSize={12}
            maxToRenderPerBatch={12}
            removeClippedSubviews
          />
        ) : (
          <JuzMemorization onOpenJuz={handleSelectJuz} />
        )}
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

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
    backgroundColor: '#FF9800',
  },
  actionButtonText: {
    color: '#ffffff',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
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
    color: '#888888',
  },
  surahDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  surahDetails: {
    fontSize: 14,
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
  juzListContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  juzListContent: {
    padding: 16,
    backgroundColor: '#1a1a1a',
  },
  juzCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#333333',
    borderColor: '#555555',
    borderWidth: 1,
  },
  juzNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  juzNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  juzText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
});