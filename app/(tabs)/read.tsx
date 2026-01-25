import { getCommonParams, logAnalyticsEvent, logAudioPlayback } from '@/utils/analyticsHelper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import type { FlashListRef } from '@shopify/flash-list';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Check, Pause, Play, RefreshCw, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageAudioManager, { AudioState, getPageAudioManager } from '../audio/PageAudioManager';

import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  PanResponder,
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
import { fetchVersesForJuz, fetchVersesForSurah, getDatabase, JuzVerse, logDatabaseTables } from '@/services/juzDbService';
import { useNavigationStore } from '@/store/navigationStore';
import { useProgressStore } from '@/store/progressStore';
import { useQuranStore } from '@/store/quranStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { Surah, Verse } from '@/types';
import {
  getAudioUrl,
  pauseAudio,
  pauseSurahAudio,
  playAudio,
  playSurahAudioWithFallback,
  resumeSurahAudio,
  stopSurahAudio,
} from '@/utils/audioUtils';
import { getArabicFontFamily, getArabicTypographySizing } from '@/utils/fontUtils';
import { useThemeColor } from '@/utils/useThemeColor';
import { getAverageVerseHeight } from '@/utils/verseLayoutUtils';
import { AutoSizeText, ResizeTextMode } from 'react-native-auto-size-text';
// Page audio indicator removed from header (compacting UI)
import PageModeButton from '@/components/PageModeButton';
import PageModeConfig from '@/components/PageModeConfig';
import { calculatePages } from '@/utils/pageUtils';

import { fetchUthmaniTajweedRnMarkupByChapter } from '@/services/quranComTajweedService';

export default function ReadScreen() {
  const router = useRouter();
  const { primary } = useThemeColor();
  const { fontSizeArabic, fontSizeTranslation, showTranslation, arabicFont, translationLanguage, defaultVersesPerPage, playbackSpeed } = useSettingsStore();
  const arabicTypography = getArabicTypographySizing(fontSizeArabic, arabicFont);
  const arabicFontFamily = getArabicFontFamily(arabicFont);

  const { surahId: paramSurahId, verseId: paramVerseId, source: paramSource, juzNumber: paramJuzNumber } = useLocalSearchParams<{
    surahId?: string;
    verseId?: string;
    source?: string;
    juzNumber?: string;
  }>();

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
    markPageAsMemorized,
    markPageAsRevised,
    unmarkPageAsMemorized,
    unmarkPageAsRevised,
  } = useProgressStore();

  const lastViewedSurahId = useQuranStore((state) => state.lastViewedSurahId);
  const setLastViewedSurahId = useQuranStore((state) => state.setLastViewedSurahId);

  // Navigation scroll position tracking
  const {
    surahListScrollY,
    setSurahListScrollY,
    juzListScrollY,
    setJuzListScrollY,
  } = useNavigationStore();

  // Track if this is initial mount (to restore position silently)
  const isInitialSurahMount = useRef(true);
  const isInitialJuzMount = useRef(true);

  // UI State
  const [tab, setTab] = useState<'surah' | 'juz'>('surah');
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [selectedJuz, setSelectedJuz] = useState<number | null>(null);
  const [navigationSource, setNavigationSource] = useState<'surahList' | 'juzList' | 'mustahabbah' | 'continueReading' | 'stats' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [verses, setVerses] = useState<Verse[]>([]);
  const [juzVerses, setJuzVerses] = useState<JuzVerse[]>([]);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPlayingSurah, setIsPlayingSurah] = useState(false);
  const [isSurahPaused, setIsSurahPaused] = useState(false);
  const [currentlyPlayingVerse, setCurrentlyPlayingVerse] = useState<{ surahId: number, verseNumber: number } | null>(null);
  // Page Mode wiring (modal + basic state so 'Pg' button is visible)
  const [pageModeVisible, setPageModeVisible] = useState(false);
  const [pageModeScope, setPageModeScope] = useState<'surah' | 'juz'>('surah');
  // Verses-per-page for the active page-mode session (ephemeral) — defaults to Settings value
  const [pageModeSessionVpp, setPageModeSessionVpp] = useState<number>(defaultVersesPerPage);
  const [isPageModeActive, setIsPageModeActive] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [surahPages, setSurahPages] = useState<any[] | null>(null);
  const [juzPages, setJuzPages] = useState<any[] | null>(null);
  const [isPlayingPage, setIsPlayingPage] = useState(false);
  const [isPagePaused, setIsPagePaused] = useState(false);
  const [playingVerseIndex, setPlayingVerseIndex] = useState<number | null>(null);
  const [completedVerses, setCompletedVerses] = useState<Set<number>>(new Set());
  const [currentRepeat, setCurrentRepeat] = useState<number>(1);
  const [totalRepeats, setTotalRepeats] = useState<number>(1);
  const pagePlayAbortRef = useRef({ aborted: false });

  // Keep screen awake during audio playback to prevent auto-lock issues on Android
  useEffect(() => {
    let isActive = false;
    const manageKeepAwake = async () => {
      // If either single-verse audio or page-mode audio is playing, keep screen on.
      if (isPlayingAudio || isPlayingPage) {
        await activateKeepAwakeAsync();
        isActive = true;
      } else {
        await deactivateKeepAwake();
        isActive = false;
      }
    };

    manageKeepAwake();

    return () => {
      // Cleanup: revert to normal screen behavior when component unmounts
      if (isActive) deactivateKeepAwake();
    };
  }, [isPlayingAudio, isPlayingPage]);

  // Page-audio manager persistent singleton will be initialized on mount
  const pageAudioManagerRef = useRef<PageAudioManager | null>(null);
  const [isPageDownloading, setIsPageDownloading] = useState(false);
  const [pageDownloadProgress, setPageDownloadProgress] = useState(0);

  // Local transient toast (small non-blocking feedback)
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hasSeenBulkHint, setHasSeenBulkHint] = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const showToast = useCallback((msg: string, duration = 1400) => {
    setToastMessage(msg);
    Animated.timing(toastAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToastMessage(null));
    }, duration);
  }, [toastAnim]);

  // Load first-time hint status from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const seen = await AsyncStorage.getItem('@bulk_hint_seen');
        setHasSeenBulkHint(seen === 'true');
      } catch (e) {
        console.error('[read] Failed to load bulk hint status', e);
      }
    })();
  }, []);

  // CRITICAL FIX: Force FlashList to rebuild when verse data changes (Fix for recycling issues)
  const [verseListKey, setVerseListKey] = useState(0);
  const [juzListKey, setJuzListKey] = useState(0);

  // Loading
  // Loading
  const [isLoading, setIsLoading] = useState(false);
  const [isJuzLoading, setIsJuzLoading] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [juzLoadingError, setJuzLoadingError] = useState<string | null>(null);

  // Go-to-verse modal
  const [goToModalVisible, setGoToModalVisible] = useState(false);
  const [goToInput, setGoToInput] = useState('');
  const [goToError, setGoToError] = useState<string | null>(null);
  const [goToSubmitting, setGoToSubmitting] = useState(false);

  // Progress modal
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [progressAction, setProgressAction] = useState<string | null>(null);
  const [progressCount, setProgressCount] = useState(0);

  // Progress store actions - badge celebrations now handled globally via CelebrationContext in _layout.tsx

  // Refs
  const flatListRef = useRef<FlashListRef<any>>(null);
  const versesRef = useRef<Verse[]>([]);
  const scrollOffsetRef = useRef(0);
  const isNavigatingBack = useRef(false);
  const suppressNextAutoOpen = useRef(false);
  const surahListRef = useRef<FlashListRef<any>>(null);
  const loadingLocks = useRef<Map<string, Promise<any>>>(new Map());

  // === Smart Progressive Header Collapse ===
  // Header state: 'full' (all controls), 'minimal' (hide bulk actions), 'collapsed' (essentials only)
  const [headerState, setHeaderState] = useState<'full' | 'minimal' | 'collapsed'>('full');
  const lastScrollY = useRef(0);
  const lastHeaderStateChangeY = useRef(0); // For hysteresis - track last state change position

  // Explicit header heights per state (FIXED HEIGHT TO ELIMINATE JITTER)
  const HEADER_HEIGHT_FULL = 100;
  const HEADER_HEIGHT_MINIMAL = 100;
  const HEADER_HEIGHT_COLLAPSED = 100;

  // Scroll thresholds with hysteresis buffer to prevent jittery state changes
  const SCROLL_THRESHOLD_MINIMAL = 100; // Collapse to minimal at 100px
  const SCROLL_THRESHOLD_COLLAPSED = 300; // Collapse to collapsed at 300px
  const HYSTERESIS_BUFFER = 60; // Increased buffer for smoother transitions

  // Guard against FlashList scroll jumps (sudden large scroll position changes)
  const MAX_SCROLL_JUMP = 500; // Ignore scroll events with jumps larger than this
  const isAutomatedScrolling = useRef(false); // Track if we are programmatically scrolling (e.g. Go to)

  // Memoized
  const filteredSurahs = useMemo(() => {
    if (!searchQuery) return surahsData;
    const query = searchQuery.toLowerCase();
    return surahsData.filter((surah) =>
      surah.englishName.toLowerCase().includes(query) ||
      (surah.englishNameTranslation?.toLowerCase() || '').includes(query) ||
      surah.name.toLowerCase().includes(query) ||
      surah.id.toString() === query
    );
  }, [searchQuery]);

  const averageVerseHeight = useMemo(() => {
    if (!verses.length) return 200;
    return getAverageVerseHeight(verses.slice(0, 10), {
      arabicFontSize: fontSizeArabic,
      showTranslation,
      translationFontSize: fontSizeTranslation,
    });
  }, [verses, fontSizeArabic, showTranslation, fontSizeTranslation]);

  const ESTIMATED_ITEM_HEIGHT = useMemo(() => {
    if (fontSizeArabic <= 24) return 140;
    if (fontSizeArabic <= 36) return 220;
    if (fontSizeArabic <= 52) return 320;
    return 450; // Very large fonts
  }, [fontSizeArabic]);

  // Restore saved Page Mode preferences on mount
  useEffect(() => {
    (async () => {
      try {
        const scope = await AsyncStorage.getItem(PAGEMODE_SCOPE_KEY);
        if (scope === 'surah' || scope === 'juz') setPageModeScope(scope);
      } catch (e) {
        console.error('[read] Failed to restore Page Mode prefs', e);
      }
    })();
  }, [showToast]);

  const PAGEMODE_SCOPE_KEY = '@pagemode_scope';
  const PAGEMODE_LASTPAGE_KEY = (scope: string, id: number | string) => `@pagemode_lastpage_${scope}_${id}`;

  // Helpers for Page Mode
  const persistPageModePrefs = useCallback(async (scope: 'surah' | 'juz') => {
    try {
      await AsyncStorage.setItem(PAGEMODE_SCOPE_KEY, scope);
    } catch (e) {
      console.error('[read] Failed to persist page mode prefs', e);
    }
  }, []);

  const loadLastPageFor = useCallback(async (scope: 'surah' | 'juz', id: number | string) => {
    try {
      const k = PAGEMODE_LASTPAGE_KEY(scope, id);
      const v = await AsyncStorage.getItem(k);
      const parsed = v ? parseInt(v, 10) : 0;
      return Number.isNaN(parsed) ? 0 : parsed;
    } catch (e) {
      console.error('[read] failed to load last page', e);
      return 0;
    }
  }, []);

  const saveLastPageFor = useCallback(async (scope: 'surah' | 'juz', id: number | string, pageIndex: number) => {
    try {
      await AsyncStorage.setItem(PAGEMODE_LASTPAGE_KEY(scope, id), String(pageIndex));
    } catch (e) {
      console.error('[read] failed to save last page', e);
    }
  }, []);

  const computeSurahPages = useCallback((vpp?: number) => {
    if (!selectedSurah) return null;
    const pages = calculatePages(verses, vpp ?? pageModeSessionVpp);
    setSurahPages(pages);
    return pages;
  }, [selectedSurah, verses, pageModeSessionVpp]);

  const computeJuzPages = useCallback((vpp?: number) => {
    if (selectedJuz == null) return null;
    // Map juz verses to Verse-like shape
    const mapped = juzVerses.map((item) => ({
      id: item.verse_id,
      surahId: item.chapter_id,
      verseNumber: item.verse_number,
      arabicText: item.ayah,
      translation: item.translation || '',
      transliteration: item.transliteration || undefined,
      pageNumber: item.page_id ? Number(item.page_id) : undefined,
      juzNumber: item.part_id ? Number(item.part_id) : undefined,
      tajweedText: (item as any).tajweedText || undefined,
    } as any));

    const pages = calculatePages(mapped, vpp ?? pageModeSessionVpp);
    setJuzPages(pages);
    return pages;
  }, [selectedJuz, juzVerses, pageModeSessionVpp]);

  // Enter Page Mode - compute pages and restore last page
  const enterPageMode = useCallback(async (scope: 'surah' | 'juz', vpp: number) => {
    // Defensive: ensure any existing page audio manager state is cleaned
    try { pageAudioManagerRef.current?.cleanup(); } catch { }
    setPageModeScope(scope);
    // keep vpp ephemeral (comes from modal) — persist scope only
    setPageModeSessionVpp(vpp ?? defaultVersesPerPage);
    await persistPageModePrefs(scope);
    setPageModeVisible(false);
    setIsPageModeActive(true);
    // Unified entry toast for Page Mode (short, 2s fade)
    try { showToast('Your are in Page mode now!', 2000); } catch { }

    // ANALYTICS: Page mode activated
    logAnalyticsEvent('page_mode_activated', {
      scope: scope,
      verses_per_page: vpp ?? defaultVersesPerPage,
      entity_id: scope === 'surah' ? selectedSurah?.id : selectedJuz,
      entity_name: scope === 'surah' ? selectedSurah?.englishName : `Juz ${selectedJuz}`,
      ...getCommonParams(),
    });

    // switch tab when selecting Juz but not loaded
    if (scope === 'juz') {
      // Clear selectedSurah so the UI falls back to the Juz list view
      setSelectedSurah(null);
      setTab('juz');
      // small non-blocking toast so user notices the switch
      try { showToast('Your are in Page mode now!', 2000); } catch { }
    }
    // If switching to surah scope ensure Juz selection is cleared so the Surah view is shown
    if (scope === 'surah') {
      setSelectedJuz(null);
      setTab('surah');
    }

    if (scope === 'surah' && selectedSurah) {
      const pages = computeSurahPages(vpp);
      const last = await loadLastPageFor('surah', selectedSurah.id);
      setCurrentPageIndex(Math.min(Math.max(0, last), (pages?.length || 1) - 1));
    } else if (scope === 'juz' && selectedJuz != null) {
      const pages = computeJuzPages(vpp);
      const last = await loadLastPageFor('juz', selectedJuz);
      setCurrentPageIndex(Math.min(Math.max(0, last), (pages?.length || 1) - 1));
    } else {
      // no currently-selected entity; set index to 0
      setCurrentPageIndex(0);
    }
  }, [persistPageModePrefs, selectedSurah, selectedJuz, computeSurahPages, computeJuzPages, loadLastPageFor]);

  // Page navigation helpers
  const handlePrevPage = useCallback(() => {
    if (!isPageModeActive) return;
    if (pageModeScope === 'surah' && surahPages) {
      setCurrentPageIndex((p) => {
        const v = Math.max(0, p - 1);
        if (selectedSurah) void saveLastPageFor('surah', selectedSurah.id, v);
        // stop page playback and reset highlights when navigating pages
        pagePlayAbortRef.current.aborted = true;
        try { pageAudioManagerRef.current?.stop(); } catch (e) { /* ignore */ }
        setPlayingVerseIndex(null);
        setCompletedVerses(new Set());
        setIsPlayingPage(false);
        setIsPagePaused(false);
        return v;
      });
    } else if (pageModeScope === 'juz' && juzPages) {
      setCurrentPageIndex((p) => {
        const v = Math.max(0, p - 1);
        if (selectedJuz != null) void saveLastPageFor('juz', selectedJuz, v);
        pagePlayAbortRef.current.aborted = true;
        try { pageAudioManagerRef.current?.stop(); } catch (e) { /* ignore */ }
        setPlayingVerseIndex(null);
        setCompletedVerses(new Set());
        setIsPlayingPage(false);
        setIsPagePaused(false);
        return v;
      });
    }
  }, [isPageModeActive, pageModeScope, surahPages, juzPages, selectedSurah, selectedJuz, saveLastPageFor]);

  const handleNextPage = useCallback(() => {
    if (!isPageModeActive) return;
    if (pageModeScope === 'surah' && surahPages) {
      setCurrentPageIndex((p) => {
        const v = Math.min((surahPages.length - 1), p + 1);
        if (selectedSurah) void saveLastPageFor('surah', selectedSurah.id, v);
        pagePlayAbortRef.current.aborted = true;
        try { pageAudioManagerRef.current?.stop(); } catch (e) { /* ignore */ }
        setPlayingVerseIndex(null);
        setCompletedVerses(new Set());
        setIsPlayingPage(false);
        setIsPagePaused(false);

        // ANALYTICS: Page navigation
        logAnalyticsEvent('page_navigation', {
          direction: 'next',
          scope: pageModeScope,
          current_page: p,
          new_page: v,
          verses_per_page: pageModeSessionVpp,
          ...getCommonParams(),
        });

        return v;
      });
    } else if (pageModeScope === 'juz' && juzPages) {
      setCurrentPageIndex((p) => {
        const v = Math.min((juzPages.length - 1), p + 1);
        if (selectedJuz != null) void saveLastPageFor('juz', selectedJuz, v);
        pagePlayAbortRef.current.aborted = true;
        try { pageAudioManagerRef.current?.stop(); } catch (e) { /* ignore */ }
        setPlayingVerseIndex(null);
        setCompletedVerses(new Set());
        setIsPlayingPage(false);
        setIsPagePaused(false);

        // ANALYTICS: Page navigation
        logAnalyticsEvent('page_navigation', {
          direction: 'next',
          scope: pageModeScope,
          current_page: p,
          new_page: v,
          verses_per_page: pageModeSessionVpp,
          ...getCommonParams(),
        });

        return v;
      });
    }
  }, [isPageModeActive, pageModeScope, surahPages, juzPages, selectedSurah, selectedJuz, saveLastPageFor, pageModeSessionVpp]);

  // Exit page mode
  const exitPageMode = useCallback(() => {
    // Stop infinite loop
    pagePlayAbortRef.current.aborted = true;
    // Ensure page audio manager is torn down when exiting Page Mode
    try { pageAudioManagerRef.current?.cleanup(); } catch { }
    setIsPageModeActive(false);
    setCurrentPageIndex(0);
    setSurahPages(null);
    setJuzPages(null);
    setIsPlayingPage(false);
    setIsPagePaused(false);
    setIsPageDownloading(false);
    setPageDownloadProgress(0);
    // close modal and show quick feedback
    try { setPageModeVisible(false); } catch { }
    // Do not show an exit toast to avoid confusion — keep only the entering toast
  }, []);

  // Recompute pages whenever verses or juzVerses change while active
  useEffect(() => {
    if (!isPageModeActive) return;
    if (pageModeScope === 'surah' && selectedSurah) {
      const pages = computeSurahPages();
      // try to ensure currentPageIndex is within bounds
      setCurrentPageIndex((idx) => Math.min(idx, (pages?.length || 1) - 1));
    } else if (pageModeScope === 'juz' && selectedJuz != null) {
      const pages = computeJuzPages();
      setCurrentPageIndex((idx) => Math.min(idx, (pages?.length || 1) - 1));
    }
  }, [isPageModeActive, pageModeScope, verses, juzVerses, selectedSurah, selectedJuz, computeSurahPages, computeJuzPages]);

  // Persist page index whenever it changes while page mode is active
  useEffect(() => {
    if (!isPageModeActive) return;
    if (pageModeScope === 'surah' && selectedSurah) {
      void saveLastPageFor('surah', selectedSurah.id, currentPageIndex);
    } else if (pageModeScope === 'juz' && selectedJuz != null) {
      void saveLastPageFor('juz', selectedJuz, currentPageIndex);
    }
  }, [currentPageIndex, isPageModeActive, pageModeScope, selectedSurah, selectedJuz, saveLastPageFor]);

  // Helper functions
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

  // Small page fade animation used during list jumps / page flips
  const pageFade = useRef(new Animated.Value(1)).current;

  // Gesture tracking for page swipe
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);

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
        (id) => id >= startVerse && id <= endVerse
      ).length;
      return { memorized: memorizedInSurah, progress: (memorizedInSurah / surah.versesCount) * 100 };
    },
    [memorizedVerses]
  );

  const getProgressColor = (progress: number): string => {
    if (progress === 0) return '#666666';
    if (progress === 100) return '#4CAF50';
    return '#FF9800';
  };

  const formatDate = (date: Date): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const getSurahCompletionDate = (surahId: number): Date | null => {
    const surah = surahsData.find((s) => s.id === surahId);
    if (!surah) return null;
    const allIds = getSurahVerseRange({ id: surah.id, versesCount: surah.versesCount });
    const memSet = new Set(memorizedVerses);
    if (!allIds.every((id) => memSet.has(id))) return null;
    let latest: Date | null = null;
    for (const id of allIds) {
      const ds = memorizedVerseDates?.[id];
      if (ds) {
        const d = new Date(ds);
        if (!latest || d > latest) latest = d;
      }
    }
    return latest;
  };

  // === Smart Progressive Header Scroll Handler ===
  // Handles progressive collapse with hysteresis and FlashList jump guards
  const handleVerseScroll = useCallback((event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;

    // Guard: Forget about automated/programmatic scrolls (e.g. Go to)
    if (isAutomatedScrolling.current) {
      lastScrollY.current = currentScrollY;
      return;
    }

    // Guard: Ignore negative scroll values (iOS bounce)
    if (currentScrollY < 0) return;

    // Guard: Ignore sudden large scroll jumps (FlashList recycling artifacts)
    const scrollDelta = Math.abs(currentScrollY - lastScrollY.current);
    if (scrollDelta > MAX_SCROLL_JUMP) {
      lastScrollY.current = currentScrollY;
      return;
    }

    const direction = currentScrollY > lastScrollY.current ? 'down' : 'up';
    const distanceSinceLastChange = Math.abs(currentScrollY - lastHeaderStateChangeY.current);

    if (direction === 'down') {
      // Scrolling down - collapse to single row, show Arabic only
      if (currentScrollY > SCROLL_THRESHOLD_MINIMAL && headerState === 'full') {
        setHeaderState('collapsed');
        lastHeaderStateChangeY.current = currentScrollY;

        // One-time hint for bulk actions
        if (!hasSeenBulkHint) {
          showToast('Tap ⋮ for bulk actions', 2500);
          setHasSeenBulkHint(true);
          AsyncStorage.setItem('@bulk_hint_seen', 'true').catch(e =>
            console.error('[read] Failed to save bulk hint status', e)
          );
        }
      }
    } else {
      // Scrolling up - expand back to full view
      if (distanceSinceLastChange > HYSTERESIS_BUFFER) {
        if (currentScrollY < SCROLL_THRESHOLD_MINIMAL && headerState !== 'full') {
          setHeaderState('full');
          lastHeaderStateChangeY.current = currentScrollY;
        }
      }
    }

    lastScrollY.current = currentScrollY;
  }, [headerState, SCROLL_THRESHOLD_MINIMAL, SCROLL_THRESHOLD_COLLAPSED, HYSTERESIS_BUFFER, MAX_SCROLL_JUMP]);

  const getVerseType = useCallback((item: any) => {
    const sId = item.surahId || item.chapter_id;
    const vNum = item.verseNumber || item.verse_number;
    // Handle 2:282 (largest verse) separately to avoid FlashList recycling crashes with large fonts
    if (sId === 2 && vNum === 282) return 'huge';
    return 'standard';
  }, []);

  // Reset header state when switching Surahs/Juz
  useEffect(() => {
    // Default to 'collapsed' (3rd level) for Juz mode as requested
    if (selectedJuz != null) {
      setHeaderState('collapsed');
    } else {
      setHeaderState('full');
    }
    lastScrollY.current = 0;
    lastHeaderStateChangeY.current = 0;
  }, [selectedSurah?.id, selectedJuz]);

  const surahStatus = useMemo(() => {
    if (!selectedSurah) return { isMemorized: false, isRevised: false };
    const allVerseIds = getSurahVerseRange({
      id: selectedSurah.id,
      versesCount: selectedSurah.versesCount,
    });
    const memorizedSet = new Set(memorizedVerses);
    const revisedSet = new Set(revisedVerses.map((v: any) => v.verseId));
    return {
      isMemorized: allVerseIds.every((id) => memorizedSet.has(id)),
      isRevised: allVerseIds.every((id) => revisedSet.has(id)),
    };
  }, [selectedSurah, memorizedVerses, revisedVerses, getSurahVerseRange]);

  // Page Mode: Compute current page verses and page-level status
  const currentPageVerses = useMemo(() => {
    try {
      if (pageModeScope === 'surah' && surahPages && surahPages[currentPageIndex]) {
        return surahPages[currentPageIndex].verses || [];
      }
      if (pageModeScope === 'juz' && juzPages && juzPages[currentPageIndex]) {
        return juzPages[currentPageIndex].verses || [];
      }
      return [];
    } catch (e) {
      return [];
    }
  }, [pageModeScope, surahPages, juzPages, currentPageIndex]);

  // Subscribe to store.pageMarks so UI updates reactively when page marks change
  const pageMarks = useProgressStore((state) => state.pageMarks);

  const isCurrentPageMemorized = useMemo(() => {
    if (!isPageModeActive || !currentPageVerses.length) return false;
    const entityId = pageModeScope === 'surah' ? selectedSurah?.id : selectedJuz;
    if (!entityId) return false;
    return pageMarks.some((m) =>
      m.scope === pageModeScope &&
      m.entityId === entityId &&
      m.pageIndex === currentPageIndex &&
      m.type === 'memorized'
    );
  }, [pageMarks, isPageModeActive, currentPageVerses.length, pageModeScope, selectedSurah?.id, selectedJuz, currentPageIndex]);

  const isCurrentPageRevised = useMemo(() => {
    if (!isPageModeActive || !currentPageVerses.length) return false;
    const entityId = pageModeScope === 'surah' ? selectedSurah?.id : selectedJuz;
    if (!entityId) return false;
    return pageMarks.some((m) =>
      m.scope === pageModeScope &&
      m.entityId === entityId &&
      m.pageIndex === currentPageIndex &&
      m.type === 'revised'
    );
  }, [pageMarks, isPageModeActive, currentPageVerses.length, pageModeScope, selectedSurah?.id, selectedJuz, currentPageIndex]);

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

  // Async loaders - Enhanced with robust retry logic and error handling
  const loadInitialVerses = useCallback(
    async (surah: Surah, retryCount = 0) => {
      const lockKey = `surah_${surah.id}_${translationLanguage}`;
      if (loadingLocks.current.has(lockKey)) return loadingLocks.current.get(lockKey);

      const loadPromise = (async () => {
        setIsLoading(true);
        setLoadingError(null);

        try {
          console.log(`[read] Loading verses for ${surah.name} (attempt ${retryCount + 1}/3)...`);

          // Load ALL verses from local DB at once (same as Juz implementation)
          const allVersesFromDB = await fetchVersesForSurah(surah.id);

          // Validate DB returned data
          if (!allVersesFromDB || allVersesFromDB.length === 0) {
            throw new Error(`No verses returned from database for ${surah.name}`);
          }

          const reciterIdentifier = useSettingsStore.getState().reciterIdentifier;

          // If user selected tajweed font, load tajweed markup for this chapter once
          // and attach it to each verse as `tajweedText` (consumed by VerseItem).
          const needsTajweed = useSettingsStore.getState().arabicFont === 'tajweed';
          const tajweedByKey = needsTajweed
            ? await fetchUthmaniTajweedRnMarkupByChapter(surah.id)
            : null;

          let mappedVerses: Verse[] = allVersesFromDB.map((v: any) => ({
            id: v.verse_id,
            surahId: v.chapter_id,
            verseNumber: v.verse_number,
            arabicText: v.ayah,
            translation: v.translation || '', // English from local DB
            transliteration: v.transliteration || undefined,
            pageNumber: v.page_id ? Number(v.page_id) : undefined,
            juzNumber: v.part_id ? Number(v.part_id) : undefined,
            audioUrl: getAudioUrl(reciterIdentifier, v.chapter_id || surah.id, v.verse_number),
            ...(needsTajweed
              ? { tajweedText: tajweedByKey?.[`${surah.id}:${v.verse_number}`] || undefined }
              : {}),
          }));

          // PERFORMANCE FIX: Local DB already has translations!
          // Removed API call that was causing 3-10 second delays for non-English languages
          // The AlQurandb.sqlite3 database contains English translations (collection_id = 2)
          // For Tamil/Malay/other languages, use the translation services instead of API
          // This matches the Juz implementation which loads instantly

          // Set ALL verses at once - FlatList handles virtualization automatically
          setVerses(mappedVerses);
          setVerseListKey(prev => prev + 1); // Force FlashList rebuild on data change
          setLastReadVerse(mappedVerses[0]);

        } catch (err: any) {
          console.error(`[read] Failed to load verses for ${surah.name}, attempt ${retryCount + 1}:`, err);

          // CRITICAL: Retry for ANY error on Android, not just database errors
          // Android can have various initialization timing issues
          if (retryCount < 2) {
            console.log(`[read] Retrying loadInitialVerses for ${surah.name} (attempt ${retryCount + 2}/3)...`);
            // Exponential backoff: 600ms, 1200ms
            const delay = 600 * (retryCount + 1);
            await new Promise(resolve => setTimeout(resolve, delay));
            loadingLocks.current.delete(lockKey);
            return loadInitialVerses(surah, retryCount + 1);
          }

          // All retries exhausted - show error to user
          const errorMessage = `Failed to load verses for ${surah.name}`;
          setLoadingError(errorMessage);
          setVerses([]);

          // Show critical error alert to user
          Alert.alert(
            '❌ Failed to Load Verses',
            `Cannot load ${surah.name} after 3 attempts.\n\nPlease try:\n1. Restart the app\n2. Check device storage\n3. Reinstall if problem persists\n\nError: ${err?.message || 'Unknown error'}`,
            [
              {
                text: 'Try Again',
                onPress: () => {
                  // Reset and try one more time
                  loadingLocks.current.delete(lockKey);
                  loadInitialVerses(surah, 0);
                },
              },
              { text: 'Cancel', style: 'cancel' }
            ]
          );

          console.error('[read] All retry attempts exhausted for', surah.name, err);
        } finally {
          setIsLoading(false);
        }
      })();

      loadingLocks.current.set(lockKey, loadPromise);
      try {
        await loadPromise;
      } finally {
        loadingLocks.current.delete(lockKey);
      }
    },
    [translationLanguage, setLastReadVerse]
  );

  const handleMoveToVerse = useCallback(
    (verseNumber: number): boolean => {
      if (!verses.length) return false;
      const verseIndex = verses.findIndex((v) => v.verseNumber === verseNumber);
      if (verseIndex >= 0) {
        // fade out -> scroll -> fade in for a pleasant page-flip feel
        Animated.sequence([
          Animated.timing(pageFade, { toValue: 0.55, duration: 140, useNativeDriver: true }),
          Animated.timing(pageFade, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]).start();

        flatListRef.current?.scrollToIndex({
          index: verseIndex,
          animated: true,
          viewPosition: 0.2,
          viewOffset: 100,
        });
        return true;
      }
      return false;
    },
    [verses]
  );

  // Event handlers
  const handleBackToSurahs = useCallback(() => {
    if (isNavigatingBack.current) return;
    isNavigatingBack.current = true;

    try {
      // Stop any playback
      setIsPlayingAudio(false);
      setIsPlayingSurah(false);
      setIsSurahPaused(false);

      // If viewing verses (either Surah or Juz), go back to list view
      if (selectedSurah || selectedJuz !== null) {
        // Ensure Page Mode is exited when going back to lists
        try { exitPageMode(); } catch { }
        console.log('[read] Back from verses to list view - clearing params');
        // CRITICAL: Clear URL params to allow fresh navigation next time
        router.replace('/(tabs)/read');
        setSelectedJuz(null);
        setSelectedSurah(null);
        setVerses([]);
        setJuzVerses([]);
        setNavigationSource(null);
      }
      // If already on list view (no selection), navigate to home tab
      else {
        console.log('[read] Back from list view to home tab');
        router.replace('/(tabs)/');
      }

      setTimeout(() => {
        isNavigatingBack.current = false;
      }, 300);
    } catch (e) {
      console.error('[read] handleBackToSurahs error', e);
      isNavigatingBack.current = false;
    }
  }, [router, selectedSurah, selectedJuz, exitPageMode]);

  const handleVersePlayAudio = useCallback(
    async (surahNum: number, verseNum: number, _globalId?: number, repeats?: number, isInfinite?: boolean) => {
      try {
        const verse = versesRef.current?.find((v) => v.surahId === surahNum && v.verseNumber === verseNum);
        const reciterIdentifier = useSettingsStore.getState().reciterIdentifier;
        const url = (verse && (verse as any).audioUrl) || getAudioUrl(reciterIdentifier, surahNum, verseNum);
        const repeatCountToUse = typeof repeats === 'number' ? repeats : 1;
        const infinite = !!isInfinite;

        if (isPlayingAudio && currentlyPlayingVerse?.surahId === surahNum && currentlyPlayingVerse?.verseNumber === verseNum) {
          await pauseAudio();
          setIsPlayingAudio(false);
          setCurrentlyPlayingVerse(null);
        } else {
          // Stop any currently playing audio first
          if (isPlayingAudio) {
            await pauseAudio();
          }

          await playAudio(url, repeatCountToUse, (status) => {
            if (status?.isPlaying) {
              setIsPlayingAudio(true);
              setCurrentlyPlayingVerse({ surahId: surahNum, verseNumber: verseNum });
            }
            // Fix: Check for exact completion conditions or explicit stop
            // When audioUtils calls stopAudio(), it sends { isPlaying: false, currentUrl: '' }
            const isStopped = status?.isPlaying === false && !status?.isPaused;
            const isFinished = status?.didJustFinish && !infinite && (status.repeatCount ?? 0) >= (status.maxRepeats ?? 1);

            if (isStopped || isFinished || status?.error) {
              setIsPlayingAudio(false);
              setCurrentlyPlayingVerse(null);
            }
          });
          setIsPlayingAudio(true);
          setCurrentlyPlayingVerse({ surahId: surahNum, verseNumber: verseNum });
        }
      } catch (e) {
        console.error('Audio playback failed:', e);
        setIsPlayingAudio(false);
        setCurrentlyPlayingVerse(null);
      }
    },
    [isPlayingAudio, currentlyPlayingVerse]
  );

  const handleToggleSurahAudio = useCallback(async () => {
    if (!selectedSurah) return;
    try {
      const action = isPlayingSurah ? 'pause' : (isSurahPaused ? 'resume' : 'play');

      if (isPlayingSurah) {
        await pauseSurahAudio();
        setIsPlayingSurah(false);
        setIsSurahPaused(true);
      } else if (isSurahPaused) {
        await resumeSurahAudio();
        setIsPlayingSurah(true);
        setIsSurahPaused(false);
      } else {
        // Diagnostic: log selected surah id and fetch a quick sample from local DB so
        // we can confirm whether the DB returns verses for the same chapter as the
        // requested surah id. This helps trace cases where selecting Surah X results
        // in audio being generated for Surah Y.
        try {
          console.log('[read] ▶️ playSurah requested for id:', selectedSurah.id);
          const sampleVerses = await fetchVersesForSurah(selectedSurah.id);
          console.log(`[read] ▶️ fetchVersesForSurah(${selectedSurah.id}) returned ${sampleVerses?.length ?? 0} verses; sample chapter_ids:`, sampleVerses.slice(0, 5).map(v => v.chapter_id));
        } catch (e) {
          console.warn('[read] ▶️ fetchVersesForSurah diagnostic failed:', e);
        }

        await playSurahAudioWithFallback(selectedSurah.id, 1, (status: any) => {
          if (status?.didJustFinish) {
            setIsPlayingSurah(false);
            setIsSurahPaused(false);
          } else if (status?.isPlaying) {
            setIsPlayingSurah(true);
            setIsSurahPaused(false);
          } else if (status?.isPaused) {
            setIsPlayingSurah(false);
            setIsSurahPaused(true);
          } else if (status?.error) {
            setIsPlayingSurah(false);
            setIsSurahPaused(false);
          }
        });
        setIsPlayingSurah(true);
        setIsSurahPaused(false);
      }

      // ANALYTICS: Consolidated audio playback event for surah audio
      logAudioPlayback({
        action: action,
        audio_type: 'surah',
        surah_id: selectedSurah.id,
        playback_speed: playbackSpeed.toString(),
      });
    } catch (e) {
      console.error('Surah audio playback failed:', e);
      setIsPlayingSurah(false);
      setIsSurahPaused(false);
    }
  }, [selectedSurah, isPlayingSurah, isSurahPaused, isPageModeActive, playbackSpeed]);

  const handleSurahMemorizeToggle = useCallback(async () => {
    if (!selectedSurah) return;
    const surahVerseIds = getSurahVerseRange({
      id: selectedSurah.id,
      versesCount: selectedSurah.versesCount,
    });
    try {
      if (isSurahMemorizedGlobally) {
        await bulkMarkVersesMemorized(surahVerseIds, false);
        surahVerseIds.forEach((id) => {
          if (memorizedVerses.includes(id)) unmarkVerseAsMemorized(id);
        });
      } else {
        await bulkMarkVersesMemorized(surahVerseIds, true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update memorization status.');
    }
  }, [selectedSurah, isSurahMemorizedGlobally, bulkMarkVersesMemorized, getSurahVerseRange, memorizedVerses, unmarkVerseAsMemorized]);

  const handleSurahRevisionToggle = useCallback(async () => {
    if (!selectedSurah) return;
    const surahVerseIds = getSurahVerseRange({
      id: selectedSurah.id,
      versesCount: selectedSurah.versesCount,
    });
    try {
      if (isSurahRevisedGlobally) {
        surahVerseIds.forEach((verseId) => unmarkVerseAsRevised(verseId));
      } else {
        await bulkMarkVersesRevised(surahVerseIds);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update revision status.');
    }
  }, [selectedSurah, isSurahRevisedGlobally, bulkMarkVersesRevised, unmarkVerseAsRevised, getSurahVerseRange]);

  // Page Mode helpers: get current page verses depending on scope
  const getCurrentPageVerses = useCallback(() => {
    try {
      if (pageModeScope === 'surah' && surahPages && surahPages[currentPageIndex]) return surahPages[currentPageIndex].verses || [];
      if (pageModeScope === 'juz' && juzPages && juzPages[currentPageIndex]) return juzPages[currentPageIndex].verses || [];
      return [];
    } catch (e) {
      return [];
    }
  }, [pageModeScope, surahPages, juzPages, currentPageIndex]);

  const handleTogglePageAudio = useCallback(async () => {
    // Ensure singleton manager exists
    if (!pageAudioManagerRef.current) pageAudioManagerRef.current = getPageAudioManager();
    const mgr = pageAudioManagerRef.current;

    // If currently playing and not paused — pause on short press
    if (isPlayingPage && !isPagePaused) {
      try {
        await mgr.pause();
        setIsPagePaused(true);
        setIsPlayingPage(false);
      } catch (e) {
        console.warn('[read] page audio pause failed', e);
      }
      return;
    }

    // If currently paused — resume on short press
    if (!isPlayingPage && isPagePaused) {
      try {
        await mgr.resume();
        setIsPagePaused(false);
        setIsPlayingPage(true);
      } catch (e) {
        console.warn('[read] page audio resume failed', e);
      }
      return;
    }

    const pageVerses = getCurrentPageVerses();
    if (!pageVerses || !pageVerses.length) return;

    // Prepare verse refs for manager
    const versesToDownload = (pageVerses || []).map((v: any) => ({
      surahNumber: v.surahId || v.chapter_id || 0,
      ayahNumber: v.verseNumber || v.verse_number || 0,
      id: v.id || v.verse_id || undefined,
    }));

    try {
      pagePlayAbortRef.current.aborted = false;
      setIsPageDownloading(true);
      setPageDownloadProgress(0);

      // Ensure caches checked before download; manager will skip cached files
      await mgr.downloadPageAudio(versesToDownload, useSettingsStore.getState().reciterIdentifier || 'ar.alafasy');

      // Download finished - start infinite loop playback
      setIsPageDownloading(false);
      setPageDownloadProgress(100);
      setIsPlayingPage(true);

      // reset per-page tracking when playback begins
      setPlayingVerseIndex(null);
      setCompletedVerses(new Set());

      const settings = useSettingsStore.getState();
      const repeatPerVerse = settings.infiniteLoop ? 0 : (settings.repeatMode || 1);

      // NEW: Infinite page looping for Page Mode ONLY
      // This runs independently and won't affect Surah mode which uses different handlers
      const playPageLoop = async () => {
        while (!pagePlayAbortRef.current.aborted) {
          try {
            await mgr.playPage(repeatPerVerse);

            // Page completed one full cycle, check if we should continue
            if (pagePlayAbortRef.current.aborted) break;

            // Reset visual indicators for next loop
            setPlayingVerseIndex(null);
            setCompletedVerses(new Set());

            // Small delay before next loop (300ms break between cycles)
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (err) {
            console.error('[read] Page loop playback error:', err);
            break;
          }
        }

        // Cleanup after loop exits (user pressed stop or error occurred)
        setIsPlayingPage(false);
        setIsPagePaused(false);
        setPlayingVerseIndex(null);
        setCompletedVerses(new Set());
      };

      // Start the infinite loop (non-blocking)
      playPageLoop();

    } catch (e) {
      console.error('[read] Page playback failed', e);
      setIsPageDownloading(false);
      setPageDownloadProgress(0);
      setIsPlayingPage(false);
      // Persistent listeners will handle UI state; no per-call cleanup needed
    }
  }, [isPlayingPage, isPagePaused, getCurrentPageVerses]);

  // Auto-scroll & page-mode verse tracking
  const scrollToVerse = useCallback((verseIndex: number) => {
    if (!isPageModeActive) return;

    // Guard against invalid indexes (out-of-bounds), which can throw in FlashList
    const pageVerses = currentPageVerses || [];
    if (verseIndex < 0 || verseIndex >= pageVerses.length) return;

    try {
      // Use requestAnimationFrame to ensure layout has settled before scrolling.
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToIndex({ index: verseIndex, animated: true, viewPosition: 0.5 });
      });
    } catch (e) {
      try {
        const offset = verseIndex * (averageVerseHeight || 200);
        flatListRef.current?.scrollToOffset({ offset, animated: true });
      } catch (_) { }
    }
  }, [isPageModeActive, averageVerseHeight, currentPageVerses]);

  useEffect(() => {
    const mgr = getPageAudioManager();

    const verseStart = (idx: number) => {
      // Only act when Page Mode is active
      if (!isPageModeActive) return;
      setPlayingVerseIndex(idx);
      // Auto-scroll to center
      scrollToVerse(idx);
      // provide light haptic feedback on verse start to enhance UX
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) { }
    };

    const verseComplete = (idx: number) => {
      if (!isPageModeActive) return;
      setCompletedVerses((prev) => new Set(Array.from(prev).concat(idx)));
    };

    const pageComplete = () => {
      if (!isPageModeActive) return;
      setPlayingVerseIndex(null);
      setCompletedVerses(new Set());
    };

    const onState = (s: AudioState) => {
      setCurrentRepeat(s.currentRepeat || 0);
      setTotalRepeats(s.totalRepeats || 1);
      // reflect manager state in local UI state
      setIsPlayingPage(!!s.isPlaying);
      setIsPagePaused(!!s.isPaused);
    };

    mgr.addVerseStartListener(verseStart);
    mgr.addVerseCompleteListener(verseComplete);
    mgr.addPageCompleteListener(pageComplete);
    mgr.addStateListener(onState);

    return () => {
      try { mgr.removeVerseStartListener(verseStart); } catch (_) { }
      try { mgr.removeVerseCompleteListener(verseComplete); } catch (_) { }
      try { mgr.removePageCompleteListener(pageComplete); } catch (_) { }
      try { mgr.removeStateListener(onState); } catch (_) { }
    };
  }, [isPageModeActive, scrollToVerse]);

  // Reset per-page playback state whenever page changes or Page Mode toggles
  useEffect(() => {
    setPlayingVerseIndex(null);
    setCompletedVerses(new Set());
    setCurrentRepeat(1);
    setTotalRepeats(1);
  }, [currentPageIndex, isPageModeActive]);

  const handleMarkPageMemorized = useCallback(async () => {
    const pageVerses = getCurrentPageVerses();
    if (!pageVerses.length) return;

    const entityId = pageModeScope === 'surah' ? selectedSurah?.id : selectedJuz;
    if (!entityId) return;

    const ids = pageVerses.map((v: any) => v.id).filter(Boolean);
    const memSet = new Set(memorizedVerses);
    const allMarked = ids.every((id: number) => memSet.has(id));

    try {
      if (allMarked) {
        // Unmark page and verses
        await bulkMarkVersesMemorized(ids, false);
        // bulkMarkVersesMemorized handles store update for verses
        unmarkPageAsMemorized(pageModeScope, entityId, currentPageIndex);
        try { showToast('Page unmarked'); } catch { }
      } else {
        // Mark page and verses
        await bulkMarkVersesMemorized(ids, true);
        // bulkMarkVersesMemorized handles store update for verses
        markPageAsMemorized(pageModeScope, entityId, currentPageIndex, pageModeSessionVpp, ids);
        try { showToast('Page memorized'); } catch { }
      }
    } catch (e) {
      console.error('[read] Failed mark page memorized', e);
    }
  }, [getCurrentPageVerses, pageModeScope, selectedSurah, selectedJuz, currentPageIndex, memorizedVerses, bulkMarkVersesMemorized, markPageAsMemorized, unmarkPageAsMemorized, pageModeSessionVpp, showToast]);

  const handleMarkPageRevised = useCallback(async () => {
    const pageVerses = getCurrentPageVerses();
    if (!pageVerses.length) return;

    const entityId = pageModeScope === 'surah' ? selectedSurah?.id : selectedJuz;
    if (!entityId) return;

    const ids = pageVerses.map((v: any) => v.id).filter(Boolean);
    const revisedSet = new Set(revisedVerses.map((v: any) => v.verseId));
    const allMarked = ids.every((id: number) => revisedSet.has(id));

    try {
      if (allMarked) {
        // Unmark page and verses
        ids.forEach((id: number) => unmarkVerseAsRevised(id)); // No bulk unmark action available yet?
        unmarkPageAsRevised(pageModeScope, entityId, currentPageIndex);
        try { showToast('Page unrevised'); } catch { }
      } else {
        // Mark page and verses
        await bulkMarkVersesRevised(ids);
        // bulkMarkVersesRevised handles store update for verses
        markPageAsRevised(pageModeScope, entityId, currentPageIndex, pageModeSessionVpp, ids);
        try { showToast('Page revised'); } catch { }
      }
    } catch (e) {
      console.error('[read] Failed mark page revised', e);
    }
  }, [getCurrentPageVerses, pageModeScope, selectedSurah, selectedJuz, currentPageIndex, revisedVerses, bulkMarkVersesRevised, unmarkVerseAsRevised, markPageAsRevised, unmarkPageAsRevised, pageModeSessionVpp, showToast]);

  // 🎯 SCROLL POSITION RESTORATION: Surah List
  useEffect(() => {
    if (isInitialSurahMount.current && surahListScrollY > 0 && !selectedSurah && tab === 'surah') {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        surahListRef.current?.scrollToOffset({
          offset: surahListScrollY,
          animated: false, // CRITICAL: No animation = instant, natural
        });
      });
      isInitialSurahMount.current = false;
    }
  }, [surahListScrollY, selectedSurah, tab]);

  // 🎯 SCROLL POSITION RESTORATION: Juz List
  useEffect(() => {
    if (isInitialJuzMount.current && juzListScrollY > 0 && selectedJuz == null && tab === 'juz') {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        surahListRef.current?.scrollToOffset({
          offset: juzListScrollY,
          animated: false, // CRITICAL: No animation = instant, natural
        });
      });
      isInitialJuzMount.current = false;
    }
  }, [juzListScrollY, selectedJuz, tab]);

  // 🎯 SAVE SURAH LIST SCROLL POSITION
  const handleSurahListScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    // Debounce: Only save every 100ms to avoid performance issues
    if ((handleSurahListScroll as any).lastSave && Date.now() - (handleSurahListScroll as any).lastSave < 100) {
      return;
    }
    setSurahListScrollY(offsetY);
    (handleSurahListScroll as any).lastSave = Date.now();
  }, [setSurahListScrollY]);

  // 🎯 SAVE JUZ LIST SCROLL POSITION
  const handleJuzListScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    // Debounce: Only save every 100ms to avoid performance issues
    if ((handleJuzListScroll as any).lastSave && Date.now() - (handleJuzListScroll as any).lastSave < 100) {
      return;
    }
    setJuzListScrollY(offsetY);
    (handleJuzListScroll as any).lastSave = Date.now();
  }, [setJuzListScrollY]);

  const handleSurahPress = (surah: Surah) => {
    setNavigationSource('surahList');
    setSelectedSurah(surah);
    setLastViewedSurahId(surah.id);
    loadInitialVerses(surah);

    // ANALYTICS: Surah selected
    logAnalyticsEvent('surah_selected', {
      surah_id: surah.id,
      surah_name: surah.englishName,
      revelation_type: surah.revelationType,
      verse_count: surah.versesCount,
      source: 'surah_list',
      ...getCommonParams(),
    });
  };

  const handleSelectJuz = async (juz: number, retryCount = 0) => {
    setNavigationSource('juzList');
    setSelectedJuz(juz);
    setIsJuzLoading(true);
    setJuzLoadingError(null);

    // ANALYTICS: Juz selected
    logAnalyticsEvent('juz_selected', {
      juz_number: juz,
      source: 'juz_list',
      ...getCommonParams(),
    });

    try {
      console.log(`[read] Loading Juz ${juz} (attempt ${retryCount + 1}/3)...`);
      const versesData = await fetchVersesForJuz(juz);

      // Validate DB returned data
      if (!versesData || versesData.length === 0) {
        throw new Error(`No verses returned from database for Juz ${juz}`);
      }

      // If user selected tajweed font, attach `tajweedText` for each verse.
      // Juz can span multiple surahs, so we fetch tajweed markup per unique chapter.
      const needsTajweed = useSettingsStore.getState().arabicFont === 'tajweed';
      let enrichedVersesData: any[] = versesData as any[];
      if (needsTajweed) {
        const chapterIds = Array.from(new Set((versesData || []).map((v: any) => Number(v.chapter_id)).filter(Boolean)));
        const tajweedMaps = await Promise.all(
          chapterIds.map(async (chapterId) => ({
            chapterId,
            map: await fetchUthmaniTajweedRnMarkupByChapter(chapterId),
          }))
        );

        const tajweedByChapter = new Map<number, Record<string, string>>();
        for (const entry of tajweedMaps) {
          tajweedByChapter.set(entry.chapterId, entry.map);
        }

        enrichedVersesData = (versesData || []).map((v: any) => {
          const chapterId = Number(v.chapter_id);
          const verseNum = Number(v.verse_number);
          const map = tajweedByChapter.get(chapterId);
          const key = `${chapterId}:${verseNum}`;
          const tajweedText = map?.[key] || undefined;
          return { ...v, tajweedText } as any;
        });
      }

      console.log(`[read] Successfully loaded ${versesData.length} verses for Juz ${juz}`);
      setJuzVerses(enrichedVersesData as any);
      setJuzListKey(prev => prev + 1); // Force FlashList rebuild on data change
      setIsJuzLoading(false);
      // If Page Mode is active and scope is 'juz', compute pages immediately and restore last page
      if (pageModeScope === 'juz' && isPageModeActive) {
        try {
          const mapped = (enrichedVersesData as any[]).map((item) => ({
            id: item.verse_id,
            surahId: item.chapter_id,
            verseNumber: item.verse_number,
            arabicText: item.ayah,
            translation: item.translation || '',
            transliteration: item.transliteration || undefined,
            pageNumber: item.page_id ? Number(item.page_id) : undefined,
            juzNumber: item.part_id ? Number(item.part_id) : undefined,
            tajweedText: item.tajweedText || undefined,
          } as any));

          const pages = calculatePages(mapped, pageModeSessionVpp);
          setJuzPages(pages);
          const last = await loadLastPageFor('juz', juz);
          const newIdx = Math.min(Math.max(0, last), (pages?.length || 1) - 1);
          setCurrentPageIndex(newIdx);
          try { showToast(`Page Mode — Juz ${juz} · Page ${newIdx + 1}`); } catch { }
        } catch (e) {
          console.error('[read] Failed to compute Juz pages while in Page Mode', e);
        }
      }

    } catch (err: any) {
      console.error(`[read] Failed to load Juz ${juz}, attempt ${retryCount + 1}:`, err);

      // CRITICAL: Retry for ANY error on Android
      if (retryCount < 2) {
        console.log(`[read] Retrying Juz ${juz} load (attempt ${retryCount + 2}/3)...`);
        // Exponential backoff: 600ms, 1200ms
        const delay = 600 * (retryCount + 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        setIsJuzLoading(false);
        return handleSelectJuz(juz, retryCount + 1);
      }

      // All retries exhausted
      setIsJuzLoading(false);
      const errorMessage = `Failed to load Juz ${juz}. Please try again.`;
      setJuzLoadingError(errorMessage);

      // Show critical error alert to user
      Alert.alert(
        '❌ Failed to Load Juz',
        `Cannot load Juz ${juz} after 3 attempts.\n\nPlease try:\n1. Restart the app\n2. Check device storage\n3. Reinstall if problem persists\n\nError: ${err?.message || 'Unknown error'}`,
        [
          {
            text: 'Try Again',
            onPress: () => handleSelectJuz(juz, 0),
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const handleMarkAllMemorized = async () => {
    if (!selectedSurah) return;
    const allIds = getSurahVerseRange(selectedSurah);
    const memorizedSet = new Set(memorizedVerses);
    const isMarking = !surahStatus.isMemorized;
    const toUpdate = allIds.filter((id) => isMarking ? !memorizedSet.has(id) : memorizedSet.has(id));

    if (!toUpdate.length) {
      Alert.alert('No Changes', 'All verses are already in the desired state.');
      return;
    }

    // ANALYTICS: Bulk mark verses
    logAnalyticsEvent('bulk_mark_verses', {
      action: isMarking ? 'mark_memorized' : 'unmark_memorized',
      surah_id: selectedSurah.id,
      surah_name: selectedSurah.englishName,
      verse_count: toUpdate.length,
      ...getCommonParams(),
    });

    // Track surah completion if marking all
    if (isMarking) {
      logAnalyticsEvent('surah_completed', {
        surah_id: selectedSurah.id,
        surah_name: selectedSurah.englishName,
        verse_count: selectedSurah.versesCount,
        ...getCommonParams(),
      });
    }

    setProgressAction(isMarking ? 'mark-memorized' : 'unmark-memorized');
    setProgressModalVisible(true);
    setProgressCount(0);

    try {
      await bulkMarkVersesMemorized(toUpdate, isMarking);
      const BATCH_SIZE = 50;
      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const batch = toUpdate.slice(i, i + BATCH_SIZE);
        isMarking
          ? batch.forEach((id) => markVerseAsMemorized(id))
          : batch.forEach((id) => unmarkVerseAsMemorized(id));
        setProgressCount(Math.min(i + BATCH_SIZE, toUpdate.length));
        await new Promise((r) => setTimeout(r, 25));
      }

      // Celebration now handled globally via CelebrationContext in _layout.tsx
    } catch (error) {
      Alert.alert('Error', 'Failed to update verses.');
    } finally {
      setProgressModalVisible(false);
      setProgressAction(null);
    }
  };

  const handleMarkAllRevised = async () => {
    if (!selectedSurah) return;
    const allIds = getSurahVerseRange(selectedSurah);
    const revisedSet = new Set(revisedVerses.map((v) => v.verseId));
    const isMarking = !surahStatus.isRevised;
    const toUpdate = allIds.filter((id) => isMarking ? !revisedSet.has(id) : revisedSet.has(id));

    if (!toUpdate.length) {
      Alert.alert('No Changes', 'All verses are already in the desired state.');
      return;
    }

    setProgressAction(isMarking ? 'mark-revised' : 'unmark-revised');
    setProgressModalVisible(true);
    setProgressCount(0);

    try {
      const BATCH_SIZE = 50;
      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const batch = toUpdate.slice(i, i + BATCH_SIZE);
        isMarking
          ? batch.forEach((id) => markVerseAsRevised(id))
          : batch.forEach((id) => unmarkVerseAsRevised(id));
        setProgressCount(Math.min(i + BATCH_SIZE, toUpdate.length));
        await new Promise((r) => setTimeout(r, 25));
      }

      // Celebration now handled globally via CelebrationContext in _layout.tsx
    } catch (error) {
      Alert.alert('Error', 'Failed to update revisions.');
    } finally {
      setProgressModalVisible(false);
      setProgressAction(null);
    }
  };

  // Render helpers
  const renderVerseOptimized = useCallback(
    ({ item: verse, index }: { item: Verse; index: number }) => {
      const isPlaying = currentlyPlayingVerse !== null &&
        currentlyPlayingVerse.surahId === verse.surahId &&
        currentlyPlayingVerse.verseNumber === verse.verseNumber;
      const pageIsPlaying = isPageModeActive && playingVerseIndex === index;
      const pageIsCompleted = isPageModeActive && completedVerses.has(index);
      const pageRepeatInfo = pageIsPlaying && totalRepeats > 1 ? `${currentRepeat}/${totalRepeats}` : undefined;

      return (
        <VerseItem
          verse={verse}
          onPlayAudio={handleVersePlayAudio}
          surahMemorizedGlobally={isSurahMemorizedGlobally}
          surahRevisedGlobally={isSurahRevisedGlobally}
          onSurahMemorizeToggle={handleSurahMemorizeToggle}
          onSurahRevisionToggle={handleSurahRevisionToggle}
          moveToVerse={handleMoveToVerse}
          source={tab === 'juz' ? 'juzList' : 'surahList'}
          isCurrentlyPlaying={isPlaying}
          pageIsPlaying={pageIsPlaying}
          pageIsCompleted={pageIsCompleted}
          pageRepeatInfo={pageRepeatInfo}
        />
      );
    },
    [handleVersePlayAudio, isSurahMemorizedGlobally, isSurahRevisedGlobally, handleSurahMemorizeToggle, handleSurahRevisionToggle, handleMoveToVerse, tab, currentlyPlayingVerse]
  );

  // Page-mode renderer for Juz pages: wraps renderVerseOptimized and injects
  // juzSequenceNumber and totalJuzVerses props so the VerseItem header shows
  // the expected "Surah X • Y/Z" labels in Juz mode.
  const renderJuzPageVerse = useCallback(({ item, index }: { item: any; index: number }) => {
    const isPlaying = currentlyPlayingVerse !== null &&
      currentlyPlayingVerse.surahId === (item.surahId || item.chapter_id) &&
      currentlyPlayingVerse.verseNumber === (item.verseNumber || item.verse_number);
    // compute global sequence number within the Juz
    const sequenceNumber = currentPageIndex * (pageModeSessionVpp || defaultVersesPerPage) + index + 1;
    // Normalize item into Verse shape expected by VerseItem
    const verseObj = {
      id: item.id ?? item.verse_id,
      surahId: item.surahId ?? item.chapter_id,
      verseNumber: item.verseNumber ?? item.verse_number,
      arabicText: item.arabicText ?? item.ayah,
      translation: item.translation ?? item.translation,
      transliteration: item.transliteration ?? item.transliteration,
      pageNumber: item.pageNumber ?? item.page_id,
      juzNumber: item.juzNumber ?? item.part_id,
      tajweedText: item.tajweedText ?? undefined,
    } as any;
    // DEV: warn if critical fields missing
    if (!verseObj.surahId || !verseObj.verseNumber) {
      console.warn('[read] renderJuzPageVerse: missing surahId/verseNumber for item', {
        item, verseObj, pageIndex: currentPageIndex, index
      });
    }

    const pageIsPlaying = isPageModeActive && playingVerseIndex === index;
    const pageIsCompleted = isPageModeActive && completedVerses.has(index);
    const pageRepeatInfo = pageIsPlaying && totalRepeats > 1 ? `${currentRepeat}/${totalRepeats}` : undefined;

    return (
      <VerseItem
        verse={verseObj}
        onPlayAudio={handleVersePlayAudio}
        surahMemorizedGlobally={false}
        surahRevisedGlobally={false}
        onSurahMemorizeToggle={() => { }}
        onSurahRevisionToggle={() => { }}
        source={'juzList'}
        isCurrentlyPlaying={isPlaying}
        pageIsPlaying={pageIsPlaying}
        pageIsCompleted={pageIsCompleted}
        pageRepeatInfo={pageRepeatInfo}
        juzSequenceNumber={sequenceNumber}
        totalJuzVerses={juzVerses.length}
      />
    );
  }, [currentlyPlayingVerse, currentPageIndex, pageModeSessionVpp, defaultVersesPerPage, handleVersePlayAudio, juzVerses.length]);

  const renderSurahItem = ({ item }: { item: Surah }) => {
    const prog = calculateSurahProgress(item.id);
    const color = getProgressColor(prog.progress);
    const revelation = item.revelationType === 'Medinan' ? 'Madani' : 'Makki';
    const showKhatm = Math.round(prog.progress) === 100;
    const completionDate = showKhatm ? getSurahCompletionDate(item.id) : null;

    return (
      <Pressable
        style={[styles.surahCard, { backgroundColor: '#333333', borderColor: '#555555', borderWidth: 1 }]}
        onPress={() => handleSurahPress(item)}
      >
        <View style={[styles.surahNumber, { backgroundColor: primary }]}>
          <Text style={styles.surahNumberText}>{item.id}</Text>
        </View>
        <View style={styles.surahInfo}>
          <Text style={styles.surahName}>{item.name}</Text>
          <Text style={styles.surahEnglish}>{item.englishName}</Text>
          <View style={styles.surahDetailsRow}>
            <Text style={styles.surahDetails}>
              {item.versesCount} verses • <Text style={{ color: '#4CAF50' }}>{revelation}</Text>
            </Text>
            {showKhatm && completionDate && (
              <Text style={styles.khatamDate}>{formatDate(completionDate)} : ختم</Text>
            )}
          </View>
        </View>
        <View style={[styles.progressPill, { backgroundColor: color }]}>
          <Text style={styles.progressText}>{Math.round(prog.progress)}%</Text>
        </View>
      </Pressable>
    );
  };

  const renderFooter = () => null; // No pagination footer needed

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No verses found</Text>
    </View>
  );

  const renderProgressModal = () => (
    <Modal transparent visible={progressModalVisible} animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: '#222', borderRadius: 12, padding: 24, alignItems: 'center', width: '80%' }}>
          <Text style={{ color: '#FFD700', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            {progressAction === 'mark-memorized' && 'Marking Memorized...'}
            {progressAction === 'unmark-memorized' && 'Unmarking Memorized...'}
            {progressAction === 'mark-revised' && 'Marking Revised...'}
            {progressAction === 'unmark-revised' && 'Unmarking Revised...'}
          </Text>
          <View style={{ width: 180, height: 8, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden', marginVertical: 16 }}>
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
        </View>
      </View>
      {/* (overlay moved out of progress modal so it shows independently when page mode is active) */}
    </Modal>
  );

  // Effects
  useEffect(() => {
    versesRef.current = verses;
  }, [verses]);

  // Badge celebrations now handled globally in _layout.tsx via CelebrationContext
  // No need for local callback registration

  // REMOVED: Auto-open lastViewedSurahId on tab click
  // This conflicted with direct Read tab navigation (should show Surah List)
  // Continue Reading card already passes surahId as param, handled by line 690's useEffect

  useEffect(() => {
    if (selectedSurah) {
      setVerses([]);
      loadInitialVerses(selectedSurah);
    }
  }, [translationLanguage, selectedSurah, loadInitialVerses]);

  useEffect(() => {
    if (!selectedSurah) {
      // No cache to clear - verses are loaded fresh each time
      return;
    }
    const hasVerses = verses.length > 0;
    const hasTajweed = hasVerses && verses.every((v: any) => !!v.tajweedText);
    const needsTajweed = arabicFont === 'tajweed';
    if ((needsTajweed && !hasTajweed) || (!needsTajweed && hasTajweed)) {
      setVerses([]);
      loadInitialVerses(selectedSurah);
    }
  }, [arabicFont, selectedSurah, translationLanguage, loadInitialVerses]);

  // Navigation: Handle route params for surahId/verseId (e.g., from Mustahabbah or Continue Reading)
  useEffect(() => {
    const sid = paramSurahId ? Number(paramSurahId) : undefined;
    const vid = paramVerseId ? Number(paramVerseId) : undefined;
    if (sid && !Number.isNaN(sid)) {
      const surah = surahsData.find((s) => s.id === sid);
      if (surah && !suppressNextAutoOpen.current) {
        console.log('[read] Processing navigation params for surah', sid, 'source:', paramSource);

        // Track where user came from for back button behavior
        if (paramSource === 'mustahabbah') {
          setNavigationSource('mustahabbah');
        } else if (paramSource === 'stats') {
          setNavigationSource('stats');
        } else if (paramSource === 'continueReading' || !paramSource) {
          // Continue Reading doesn't pass source, or no source = from home
          setNavigationSource('continueReading');
        }

        setSelectedSurah(surah);
        setLastViewedSurahId(surah.id);
        if (vid && !Number.isNaN(vid)) {
          // targetVerseRef.current = vid;
        }
        loadInitialVerses(surah);
      }
    }
  }, [paramSurahId, paramVerseId, paramSource, setLastViewedSurahId, loadInitialVerses]);

  // Navigation: Handle Juz navigation from bookmarks
  useEffect(() => {
    const juzNum = paramJuzNumber ? Number(paramJuzNumber) : undefined;
    const vid = paramVerseId ? Number(paramVerseId) : undefined;

    if (juzNum && !Number.isNaN(juzNum) && !suppressNextAutoOpen.current) {
      console.log('[read] Processing Juz navigation params - juzNumber:', juzNum, 'verseId:', vid);

      // CRITICAL: Switch to Juz tab FIRST, then load verses
      setTab('juz');
      handleSelectJuz(juzNum);
    }
  }, [paramJuzNumber]);

  // Scroll to specific verse in Juz mode after verses are loaded
  useEffect(() => {
    const vid = paramVerseId ? Number(paramVerseId) : undefined;
    console.log('[read] Juz scroll effect - vid:', vid, 'juzVerses.length:', juzVerses.length, 'tab:', tab);

    if (!vid || Number.isNaN(vid) || !juzVerses.length || tab !== 'juz') {
      console.log('[read] Juz scroll effect - conditions not met, skipping');
      return;
    }

    const verseIndex = juzVerses.findIndex((v) => v.verse_id === vid);
    console.log('[read] Juz scroll effect - searching for verse_id:', vid, 'found at index:', verseIndex);

    if (verseIndex >= 0) {
      // Add delay to ensure FlashList is fully mounted and measured
      setTimeout(() => {
        try {
          console.log('[read] Attempting to scroll to Juz verse index:', verseIndex);
          flatListRef.current?.scrollToIndex({
            index: verseIndex,
            animated: false,
            viewPosition: 0.1,
          });
          console.log('[read] Successfully scrolled to Juz verse index:', verseIndex);
        } catch (e) {
          console.error('[read] Juz auto-scroll to verse failed:', e);
        }
      }, 800); // Slightly longer delay for Juz verses
    } else {
      console.log('[read] Juz scroll effect - verse not found in juzVerses array');
    }
  }, [juzVerses, paramVerseId, tab]);

  // Scroll to specific verse after loading (for bookmarks, AyahOfTheDay, etc.)
  useEffect(() => {
    const vid = paramVerseId ? Number(paramVerseId) : undefined;
    if (!vid || Number.isNaN(vid) || !verses.length) return;

    const verseIndex = verses.findIndex((v) => v.id === vid);

    if (verseIndex >= 0) {
      // Add delay to ensure FlashList is fully mounted and measured
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToIndex({
            index: verseIndex,
            animated: false, // Use instant scroll for accuracy
            viewPosition: 0.1,
          });
        } catch (e) {
          console.error('[read] Auto-scroll to verse failed:', e);
        }
      }, 500); // Increased delay for FlashList to measure items
    }
  }, [verses, paramVerseId]);

  // Cleanup audio when surah changes
  useEffect(() => {
    if (!selectedSurah) return;
    (async () => {
      try {
        await pauseSurahAudio();
      } catch { }
      setIsPlayingSurah(false);
      setIsSurahPaused(false);
    })();
  }, [selectedSurah?.id]);

  // Pre-initialize database on component mount to avoid race conditions
  useEffect(() => {
    (async () => {
      try {
        await getDatabase();
        console.log('[read] Database pre-initialized successfully');
      } catch (err) {
        console.error('[read] Database pre-initialization failed:', err);
      }
    })();
  }, []);

  // Cleanup page audio manager on unmount
  useEffect(() => {
    // Initialize singleton and add persistent UI listeners for header/overlay
    const mgr = getPageAudioManager();
    pageAudioManagerRef.current = mgr;

    const handleDownload = (p: number) => {
      setIsPageDownloading(true);
      setPageDownloadProgress(p);
    };

    const handleState = (s: AudioState) => {
      setIsPlayingPage(s.isPlaying);
      setIsPageDownloading(false);
      setPageDownloadProgress(s.downloadProgress || 0);
    };

    const handleError = (err: Error) => {
      console.error('[read] PageAudioManager error', err);
      setIsPageDownloading(false);
      setPageDownloadProgress(0);
      setIsPlayingPage(false);
      // stop/reset playback indices
      setPlayingVerseIndex(null);
      setCompletedVerses(new Set());
    };

    mgr.addDownloadProgressListener(handleDownload);
    mgr.addStateListener(handleState);
    mgr.addErrorListener(handleError);

    return () => {
      try { pageAudioManagerRef.current?.cleanup(); } catch (e) { /* ignore */ }
      try { mgr.removeDownloadProgressListener(handleDownload); } catch (_) { }
      try { mgr.removeStateListener(handleState); } catch (_) { }
      try { mgr.removeErrorListener(handleError); } catch (_) { }
    };
  }, []);

  // Reset to Surah list whenever Recite tab gains focus (UNLESS direct navigation with params)
  useFocusEffect(
    React.useCallback(() => {
      // CRITICAL: Check params FIRST to determine if this is direct navigation
      // Check for BOTH paramSurahId (Surah bookmarks) AND paramJuzNumber (Juz bookmarks)
      const hasNavigationParams = (paramSurahId || paramJuzNumber) && !suppressNextAutoOpen.current;

      console.log('[read] Tab gained focus - hasParams:', hasNavigationParams, 'params:', { paramSurahId, paramJuzNumber, paramVerseId, paramSource }, 'current state:', { selectedSurah: selectedSurah?.id, selectedJuz, tab });

      // CRITICAL: Only reset if this is a TAB CLICK (no params), not direct navigation
      if (!hasNavigationParams) {
        console.log('[read] Tab click detected (no params) - resetting to Surah list');

        // Stop any playing audio
        (async () => {
          try {
            await pauseSurahAudio();
            await pauseAudio();
          } catch (err) {
            console.error('[read] Error stopping audio:', err);
          }
        })();

        // Reset all state to show Surah list
        // Exit page mode if active
        try { exitPageMode(); } catch { }
        setSelectedSurah(null);
        setSelectedJuz(null);
        setVerses([]);
        setJuzVerses([]);
        setNavigationSource(null);
        setTab('surah');
        setIsPlayingAudio(false);
        setIsPlayingSurah(false);
        setIsSurahPaused(false);
      } else {
        console.log('[read] Direct navigation detected (has params) - preserving state');
      }

      // Cleanup function
      return () => {
        console.log('[read] Tab lost focus');
      };
    }, [paramSurahId, paramJuzNumber, paramVerseId, paramSource, exitPageMode])
  );

  useEffect(() => {
    logDatabaseTables();
  }, []);

  // ==========================================
  // ANALYTICS: Session Duration Tracking
  // ==========================================
  useEffect(() => {
    const sessionStart = Date.now();

    return () => {
      const sessionDuration = Math.round((Date.now() - sessionStart) / 1000); // in seconds

      logAnalyticsEvent('recite_session_duration', {
        duration_seconds: sessionDuration,
        surah_id: selectedSurah?.id || null,
        juz_number: selectedJuz || null,
        page_mode_active: isPageModeActive,
        ...getCommonParams(),
      });
    };
  }, [selectedSurah, selectedJuz, isPageModeActive]);

  // Refs for PanResponder to avoid stale closures
  const isPageModeActiveRef = useRef(isPageModeActive);
  useEffect(() => { isPageModeActiveRef.current = isPageModeActive; }, [isPageModeActive]);

  const handlePrevPageRef = useRef(handlePrevPage);
  useEffect(() => { handlePrevPageRef.current = handlePrevPage; }, [handlePrevPage]);

  const handleNextPageRef = useRef(handleNextPage);
  useEffect(() => { handleNextPageRef.current = handleNextPage; }, [handleNextPage]);

  const pageSwipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        if (!isPageModeActiveRef.current) return false;
        const { dx, dy } = gestureState;
        // Capture horizontal swipes that are significantly horizontal
        return Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 20;
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const { dx } = gestureState;
        if (dx > 50) {
          if (__DEV__) console.log('[read] Swipe Right -> Prev Page');
          handlePrevPageRef.current();
        } else if (dx < -50) {
          if (__DEV__) console.log('[read] Swipe Left -> Next Page');
          handleNextPageRef.current();
        }
      },
    })
  ).current;

  // Render
  return (
    <View style={[styles.container, { backgroundColor: '#1a1a1a' }]}>
      {renderProgressModal()}

      <Modal visible={goToModalVisible} transparent animationType="slide" onRequestClose={() => setGoToModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ width: '100%', maxWidth: 400, backgroundColor: '#222', borderRadius: 16, padding: 24, alignItems: 'center' }}>
            <Text style={{ color: '#FFD700', fontSize: 20, fontWeight: '700', marginBottom: 8 }}>Go to Verse</Text>
            {selectedJuz != null && (
              <Text style={{ color: '#FFD700', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
                Format: surah:verse (e.g., 2:255)
              </Text>
            )}
            <TextInput
              style={{ width: '100%', color: '#fff', fontSize: 16, backgroundColor: '#333', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, borderWidth: 1, borderColor: '#555' }}
              placeholder={selectedJuz != null ? "e.g., 2:255 or 110" : "Enter verse number"}
              placeholderTextColor="#888"
              value={goToInput}
              onChangeText={setGoToInput}
              keyboardType={selectedJuz != null ? "default" : "numeric"}
              autoFocus
              editable={!goToSubmitting}
            />
            {selectedJuz != null && (
              <Text style={{ color: '#888', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>
                Enter surah:verse (e.g., 2:251) or verse position (e.g., 110)
              </Text>
            )}
            {goToError && <Text style={{ color: '#ff5252', fontSize: 14, marginBottom: 8 }}>{goToError}</Text>}
            <View style={{ flexDirection: 'row', width: '100%', marginTop: 8 }}>
              <Pressable
                style={{ flex: 1, backgroundColor: '#444', borderRadius: 8, alignItems: 'center', paddingVertical: 10, marginRight: 4 }}
                onPress={() => { setGoToModalVisible(false); setGoToInput(''); setGoToError(null); }}
                disabled={goToSubmitting}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={{ flex: 1, backgroundColor: '#FFD700', borderRadius: 8, alignItems: 'center', paddingVertical: 10, marginLeft: 4 }}
                onPress={async () => {
                  if (!selectedSurah && selectedJuz == null) return;

                  setGoToSubmitting(true);
                  setGoToError(null);

                  let idx = -1;

                  // SURAH MODE: Simple verse number
                  if (selectedSurah) {
                    const num = parseInt(goToInput, 10);

                    if (isNaN(num) || num < 1 || num > selectedSurah.versesCount) {
                      setGoToError(`Enter verse 1-${selectedSurah.versesCount}`);
                      setGoToSubmitting(false);
                      return;
                    }

                    idx = verses.findIndex((v) => v.verseNumber === num);

                    if (idx === -1) {
                      setGoToError('Verse not found. Check the verse number.');
                      setGoToSubmitting(false);
                      return;
                    }
                  }

                  // JUZ MODE: Supports both formats:
                  // 1. Surah:verse format (e.g., 2:255)
                  // 2. Simple verse position within juz (e.g., 110 for 110th verse in the juz)
                  else if (selectedJuz != null) {
                    const input = goToInput.trim();

                    // Check if input contains ':' for surah:verse format
                    if (input.includes(':')) {
                      // FORMAT 1: surah:verse (e.g., 2:255)
                      const parts = input.split(':');
                      if (parts.length !== 2) {
                        setGoToError('Use format: surah:verse (e.g., 2:255) or verse number (e.g., 110)');
                        setGoToSubmitting(false);
                        return;
                      }

                      const surahNum = parseInt(parts[0].trim(), 10);
                      const verseNum = parseInt(parts[1].trim(), 10);

                      if (isNaN(surahNum) || isNaN(verseNum) || surahNum < 1 || surahNum > 114 || verseNum < 1) {
                        setGoToError('Invalid surah or verse number');
                        setGoToSubmitting(false);
                        return;
                      }

                      console.log('[read] Go to verse in Juz mode (surah:verse):', { surahNum, verseNum, selectedJuz });

                      // Find verse by BOTH chapter_id AND verse_number
                      idx = juzVerses.findIndex((v) => v.chapter_id === surahNum && v.verse_number === verseNum);

                      console.log('[read] Search result: idx =', idx, 'for', surahNum + ':' + verseNum);

                      if (idx === -1) {
                        // Check if the surah exists in this juz at all
                        const surahExistsInJuz = juzVerses.some((v) => v.chapter_id === surahNum);
                        if (!surahExistsInJuz) {
                          setGoToError(`Surah ${surahNum} is not in Juz ${selectedJuz}`);
                        } else {
                          // Surah exists but verse doesn't
                          const versesInSurah = juzVerses.filter((v) => v.chapter_id === surahNum);
                          if (versesInSurah.length > 0) {
                            const minVerse = Math.min(...versesInSurah.map(v => v.verse_number));
                            const maxVerse = Math.max(...versesInSurah.map(v => v.verse_number));
                            setGoToError(`Surah ${surahNum} in Juz ${selectedJuz} has verses ${minVerse}-${maxVerse}`);
                          } else {
                            setGoToError(`Verse ${surahNum}:${verseNum} not found in Juz ${selectedJuz}`);
                          }
                        }
                        setGoToSubmitting(false);
                        return;
                      }
                    } else {
                      // FORMAT 2: Simple verse position within juz (e.g., 110)
                      const versePosition = parseInt(input, 10);

                      if (isNaN(versePosition) || versePosition < 1) {
                        setGoToError('Enter a valid verse number or surah:verse format');
                        setGoToSubmitting(false);
                        return;
                      }

                      // Convert 1-based position to 0-based index
                      idx = versePosition - 1;

                      if (idx < 0 || idx >= juzVerses.length) {
                        setGoToError(`Enter verse 1-${juzVerses.length} or use surah:verse format`);
                        setGoToSubmitting(false);
                        return;
                      }

                      // Get the actual verse info for user feedback
                      const targetVerse = juzVerses[idx];
                      console.log('[read] Go to verse position', versePosition, 'in Juz', selectedJuz,
                        '-> Surah', targetVerse.chapter_id, 'Verse', targetVerse.verse_number);
                    }
                  }

                  console.log('[read] Found verse at index', idx, '- attempting scroll');

                  // Scroll to verse (only if idx is valid)
                  if (idx !== -1 && idx >= 0) {
                    try {
                      console.log('[read] Executing scrollToIndex for index:', idx);

                      // LOCK HEADER: Prevent layout shifts during jump to avoid Skia/Metal race conditions
                      isAutomatedScrolling.current = true;

                      // SMART PAGINATION: Handle jumping across pages in Page Mode
                      if (isPageModeActive) {
                        const vpp = pageModeSessionVpp || defaultVersesPerPage;
                        const pageIndex = Math.floor(idx / vpp);
                        const innerIndex = idx % vpp;

                        if (currentPageIndex !== pageIndex) {
                          setCurrentPageIndex(pageIndex);
                          setTimeout(() => {
                            try {
                              flatListRef.current?.scrollToIndex({ index: innerIndex, animated: true, viewPosition: 0.2 });
                            } catch (err) {
                              flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
                            }
                            // Unlock after animation
                            setTimeout(() => { isAutomatedScrolling.current = false; }, 800);
                          }, 150);
                        } else {
                          flatListRef.current?.scrollToIndex({ index: innerIndex, animated: true, viewPosition: 0.2 });
                          setTimeout(() => { isAutomatedScrolling.current = false; }, 800);
                        }
                      } else {
                        // NORMAL LIST MODE: Jump directly
                        // Using a simple check to skip animations for VERY massive jumps (prevents Skia animation crashes)
                        const currentIdx = lastScrollY.current / (averageVerseHeight || 200);
                        const isExtremeJump = Math.abs(idx - currentIdx) > 300;

                        flatListRef.current?.scrollToIndex({
                          index: idx,
                          animated: !isExtremeJump, // Restore animation for reasonably large jumps (like verse 282)
                          viewPosition: 0.2
                        });

                        // Unlock header after animation finishes
                        setTimeout(() => { isAutomatedScrolling.current = false; }, isExtremeJump ? 100 : 1000);
                      }


                      // Close modal after successful scroll initiation
                      setGoToModalVisible(false);
                      setGoToInput('');
                      setGoToError(null);
                    } catch (e) {
                      console.error('[read] Scroll failed:', e);
                      // Fallback to scrollToOffset if scrollToIndex fails
                      const offset = idx * (averageVerseHeight || 200);
                      // fade out -> scroll -> fade in for fallback scroll too
                      Animated.sequence([
                        Animated.timing(pageFade, { toValue: 0.55, duration: 140, useNativeDriver: true }),
                        Animated.timing(pageFade, { toValue: 1, duration: 250, useNativeDriver: true }),
                      ]).start();

                      flatListRef.current?.scrollToOffset({ offset, animated: true });

                      // Close modal after fallback scroll
                      setGoToModalVisible(false);
                      setGoToInput('');
                      setGoToError(null);
                    }
                  } else {
                    console.error('[read] Invalid index for scroll:', idx);
                    setGoToError('Invalid verse index');
                  }

                  setGoToSubmitting(false);
                }}
                disabled={goToSubmitting}
              >
                <Text style={{ color: '#222', fontSize: 16, fontWeight: '600' }}>Go</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================ */}
      {/* SMART PROGRESSIVE HEADER (Verse View Only) */}
      {/* ============================================ */}
      {selectedSurah || selectedJuz != null ? (
        <View style={[
          styles.smartHeader,
          headerState === 'minimal' && styles.smartHeaderMinimal,
          headerState === 'collapsed' && styles.smartHeaderCollapsed,
          { minHeight: headerState === 'collapsed' ? HEADER_HEIGHT_COLLAPSED : headerState === 'minimal' ? HEADER_HEIGHT_MINIMAL : HEADER_HEIGHT_FULL }
        ]}>

          {/* ROW 1: Always Visible (even when collapsed) */}
          <View style={styles.alwaysVisibleRow}>
            {/* Back button - ALWAYS VISIBLE */}
            <TouchableOpacity onPress={handleBackToSurahs} style={{ marginRight: 8 }}>
              <ArrowLeft size={24} color="#C5A059" />
            </TouchableOpacity>

            {/* Core Info - ALWAYS VISIBLE */}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              {selectedSurah ? (
                <>
                  <Text style={styles.compactSurahNumber}>{selectedSurah.id}.</Text>
                  {/* English name - HIDE in collapsed to save space */}
                  {headerState === 'full' && (
                    <Text style={styles.compactSurahName} numberOfLines={1}>
                      {selectedSurah.englishName}
                    </Text>
                  )}
                  {/* Arabic name - ALWAYS visible in this new simplified design */}
                  <Text style={styles.compactSurahArabic} numberOfLines={1}>
                    {selectedSurah.arabicName}
                  </Text>
                </>
              ) : (
                <Text style={styles.compactSurahName} numberOfLines={1}>Juz {selectedJuz}</Text>
              )}
            </View>

            {/* Play button - ONLY if Surah selected OR in Page Mode */}
            {(selectedSurah || isPageModeActive) && (
              <TouchableOpacity
                onPress={() => {
                  if (isPageModeActive) void handleTogglePageAudio();
                  else void handleToggleSurahAudio();
                }}
                onLongPress={async () => {
                  if (!pageAudioManagerRef.current) pageAudioManagerRef.current = getPageAudioManager();
                  const mgr = pageAudioManagerRef.current;
                  if (isPageModeActive) {
                    try { await mgr.stop(); } catch (e) { console.warn('[read] page audio stop failed', e); }
                    pagePlayAbortRef.current.aborted = true;
                    setIsPlayingPage(false);
                    setIsPagePaused(false);
                    setIsPageDownloading(false);
                    setPageDownloadProgress(0);
                  } else {
                    try {
                      await stopSurahAudio();
                      setIsPlayingSurah(false);
                      setIsSurahPaused(false);
                    } catch (e) { console.warn('[read] stop surah audio failed', e); }
                  }
                }}
                style={[
                  styles.compactPlayButton,
                  (isPlayingSurah || isPlayingPage) && { backgroundColor: '#C5A059', borderColor: '#C5A059' }
                ]}
                activeOpacity={0.8}
              >
                {isPageDownloading ? (
                  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="small" color="#C5A059" />
                  </View>
                ) : (isPlayingSurah || isPlayingPage) ? (
                  <Pause size={18} color="#1a1a1a" />
                ) : (
                  <Play size={18} color="#C5A059" />
                )}
              </TouchableOpacity>
            )}


            {/* Go To Verse - ALWAYS VISIBLE */}
            <Pressable
              onPress={() => setGoToModalVisible(true)}
              style={styles.miniButton}
            >
              <ArrowRight size={16} color="#C5A059" />
            </Pressable>

            {/* Page Mode - ALWAYS VISIBLE */}
            <PageModeButton
              onPress={() => {
                const defaultScope = selectedSurah ? 'surah' : (selectedJuz != null ? 'juz' : pageModeScope);
                setPageModeScope(defaultScope);
                setPageModeVisible(true);
              }}
              onLongPress={() => showToast('Page Mode', 1200)}
              isActive={isPageModeActive}
              style={{ width: 36, height: 36, marginLeft: 8 }}
            />

            {/* Expand menu (⋮) - ONLY if Surah selected OR in Page Mode OR Juz selected */}
            {headerState !== 'full' && (selectedSurah || selectedJuz != null || isPageModeActive) && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setHeaderState('full');
                }}
                style={styles.expandButton}
                accessibilityLabel="Show all controls"
              >
                <Text style={{ color: '#C5A059', fontSize: 22, fontWeight: '700' }}>⋮</Text>
              </TouchableOpacity>
            )}

            {/* If neither Surah nor Page Mode, provide a small spacer to maintain right-alignment alignment */}
            {headerState !== 'full' && !(selectedSurah || isPageModeActive) && (
              <View style={{ width: 8 }} />
            )}

          </View>

          {/* ROW 2 (Secondary Info) REMOVED in refined layout */}


          {/* ROW 3: ONLY in FULL state (bulk actions) */}
          {headerState === 'full' && (
            <View style={styles.bulkActionsRow}>
              {/* Page Mode: Show page-level buttons */}
              {isPageModeActive && (pageModeScope === 'surah' || pageModeScope === 'juz') ? (
                <>
                  <Pressable
                    style={({ pressed }) => [
                      styles.bulkActionButton,
                      isCurrentPageMemorized && styles.bulkActionButtonActive,
                      { opacity: (!currentPageVerses.length || pressed) ? 0.7 : 1 }
                    ]}
                    onPress={handleMarkPageMemorized}
                    disabled={!currentPageVerses.length}
                  >
                    <Check size={14} color="#ffffff" />
                    <Text style={styles.bulkActionText} numberOfLines={1}>
                      {isCurrentPageMemorized ? 'Page Memorized' : 'Mark Page'}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.bulkActionButton,
                      isCurrentPageRevised && styles.bulkActionButtonRevised,
                      { opacity: (!currentPageVerses.length || pressed) ? 0.7 : 1 }
                    ]}
                    onPress={handleMarkPageRevised}
                    disabled={!currentPageVerses.length}
                  >
                    <RefreshCw size={14} color="#ffffff" />
                    <Text style={styles.bulkActionText} numberOfLines={1}>
                      {isCurrentPageRevised ? 'Page Revised' : 'Mark Revised'}
                    </Text>
                  </Pressable>
                </>
              ) : selectedSurah ? (
                // Surah Mode: Show surah-level "Mark All" buttons
                <>
                  <Pressable
                    style={({ pressed }) => [
                      styles.bulkActionButton,
                      surahStatus.isMemorized && styles.bulkActionButtonActive,
                      { opacity: pressed ? 0.7 : 1 }
                    ]}
                    onPress={handleMarkAllMemorized}
                  >
                    <Check size={14} color="#ffffff" />
                    <Text style={styles.bulkActionText} numberOfLines={1}>
                      {surahStatus.isMemorized ? 'All Memorized' : 'Mark All Verses'}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.bulkActionButton,
                      surahStatus.isRevised && styles.bulkActionButtonRevised,
                      { opacity: pressed ? 0.7 : 1 }
                    ]}
                    onPress={handleMarkAllRevised}
                  >
                    <RefreshCw size={14} color="#ffffff" />
                    <Text style={styles.bulkActionText} numberOfLines={1}>
                      {surahStatus.isRevised ? 'All Revised' : 'Mark All Revised'}
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          )}

          {/* Separator line */}
          <View style={styles.headerSeparator} />
        </View>
      ) : (
        /* ============================================ */
        /* ORIGINAL HEADER (List View - Unchanged)     */
        /* ============================================ */
        <View style={styles.headerContainer}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity onPress={handleBackToSurahs} style={{ marginRight: 12 }}>
              <ArrowLeft size={28} color="#C5A059" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <AutoSizeText
                numberOfLines={2}
                mode={ResizeTextMode.min_font_size}
                fontSize={18}
                minFontSize={14}
                style={[styles.headerTitle, { paddingHorizontal: 16, textAlign: 'center', lineHeight: 24 }]}
              >
                Recite Qur'an in measured and rhythmic tone!
              </AutoSizeText>
            </View>
          </View>
        </View>
      )}

      {!selectedSurah && selectedJuz == null && navigationSource !== 'mustahabbah' && navigationSource !== 'stats' && (
        <View style={[styles.searchBarContainer, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
          <View style={[styles.searchInputWrapper, { flex: 1 }]}>
            <Search size={20} color="#888888" />
            <TextInput
              style={[styles.searchInput, { color: '#ffffff' }]}
              placeholder="Search"
              placeholderTextColor="#888888"
              value={searchQuery}
              onChangeText={setSearchQuery}
              editable={tab !== 'juz'}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={18} color="#888888" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={() => setTab('surah')} style={[styles.tabButton, tab === 'surah' && { backgroundColor: primary }]}>
            <Text style={[styles.tabText, tab === 'surah' && styles.tabTextActive]}>Surah</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('juz')} style={[styles.tabButton, tab === 'juz' && { backgroundColor: primary }]}>
            <Text style={[styles.tabText, tab === 'juz' && styles.tabTextActive]}>Juz</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Page Mode configuration modal - minimal wiring so the Pg button opens the modal */}
      <PageModeConfig
        visible={pageModeVisible}
        initialScope={pageModeScope}
        initialVersesPerPage={defaultVersesPerPage}
        onCancel={() => setPageModeVisible(false)}
        onStart={(scope, versesPerPage) => {
          void enterPageMode(scope, versesPerPage);
        }}
      />

      <View style={[styles.container, { backgroundColor: '#0B0E14' }]}>
        {selectedSurah ? (
          <View style={[styles.versesContainer, { backgroundColor: '#0B0E14' }]}>
            {isLoading ? (
              <View style={[styles.loadingContainer, { backgroundColor: '#0B0E14' }]}>
                <ActivityIndicator size="large" color={primary} />
                <Text style={[styles.loadingText, { color: '#ffffff' }]}>Loading verses...</Text>
              </View>
            ) : loadingError ? (
              <View style={[styles.errorContainer, { backgroundColor: '#0B0E14' }]}>
                <Text style={[styles.errorText, { color: '#ff5252' }]}>{loadingError}</Text>
                <Pressable style={[styles.retryButton, { backgroundColor: primary }]} onPress={() => loadInitialVerses(selectedSurah)}>
                  <Text style={[styles.retryButtonText, { color: '#ffffff' }]}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <Animated.View
                style={{ opacity: pageFade, flex: 1 }}
                {...pageSwipeResponder.panHandlers}
              >
                {isPageModeActive && pageModeScope === 'surah' && surahPages && surahPages.length > 0 ? (
                  <FlashList
                    key={`pagemode-surah-${selectedSurah?.id}-${currentPageIndex}-${verseListKey}`}
                    ref={flatListRef}
                    data={surahPages[currentPageIndex]?.verses || []}
                    renderItem={renderVerseOptimized}
                    getItemType={getVerseType}
                    keyExtractor={(item: any) => `verse-${item.id}-${item.surahId}-${item.verseNumber}`}
                    {...({ estimatedItemSize: ESTIMATED_ITEM_HEIGHT } as any)}
                    ListEmptyComponent={renderEmpty}
                    contentContainerStyle={styles.verseList}
                    onScroll={handleVerseScroll}
                    scrollEventThrottle={16}
                  />
                ) : (
                  <FlashList
                    key={`verse-list-${verseListKey}`}
                    ref={flatListRef}
                    data={verses}
                    getItemType={getVerseType}
                    renderItem={renderVerseOptimized}
                    keyExtractor={(item: any) => `verse-${item.id}-${item.surahId}-${item.verseNumber}`}
                    {...({ estimatedItemSize: ESTIMATED_ITEM_HEIGHT } as any)}
                    ListEmptyComponent={renderEmpty}
                    contentContainerStyle={styles.verseList}
                    onScroll={handleVerseScroll}
                    scrollEventThrottle={16}
                  />
                )}
              </Animated.View>
            )}
          </View>
        ) : selectedJuz != null ? (
          <View style={[styles.versesContainer, { backgroundColor: '#1a1a1a' }]}>
            {isJuzLoading ? (
              <View style={[styles.loadingContainer, { backgroundColor: '#1a1a1a' }]}>
                <ActivityIndicator size="large" color={primary} />
                <Text style={[styles.loadingText, { color: '#ffffff' }]}>Loading verses...</Text>
              </View>
            ) : juzLoadingError ? (
              <View style={[styles.errorContainer, { backgroundColor: '#1a1a1a' }]}>
                <Text style={[styles.errorText, { color: '#ff5252' }]}>{juzLoadingError}</Text>
                <Pressable style={[styles.retryButton, { backgroundColor: primary }]} onPress={() => handleSelectJuz(selectedJuz)}>
                  <Text style={[styles.retryButtonText, { color: '#ffffff' }]}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <Animated.View
                style={{ opacity: pageFade, flex: 1 }}
                {...pageSwipeResponder.panHandlers}
              >
                {isPageModeActive && pageModeScope === 'juz' && juzPages && juzPages.length > 0 ? (
                  <FlashList
                    key={`pagemode-juz-${selectedJuz}-${currentPageIndex}-${juzListKey}`}
                    ref={flatListRef}
                    data={juzPages[currentPageIndex]?.verses || []}
                    getItemType={getVerseType}
                    keyExtractor={(item: any, index: number) => `juz-${item.id ?? item.verse_id}-${index}`}
                    {...({ estimatedItemSize: ESTIMATED_ITEM_HEIGHT } as any)}
                    renderItem={renderJuzPageVerse}
                    contentContainerStyle={[styles.versesContent, { backgroundColor: '#1a1a1a' }]}
                    onScroll={handleVerseScroll}
                    scrollEventThrottle={16}
                  />
                ) : (
                  <FlashList
                    key={`juz-list-${juzListKey}`}
                    ref={flatListRef}
                    data={juzVerses}
                    getItemType={getVerseType}
                    keyExtractor={(item: any, index: number) => `juz-${item.verse_id}-${item.chapter_id}-${item.verse_number}`}
                    {...({ estimatedItemSize: ESTIMATED_ITEM_HEIGHT } as any)}
                    onScroll={handleVerseScroll}
                    scrollEventThrottle={16}
                    renderItem={({ item, index }: { item: any; index: number }) => {
                      const isPlaying = currentlyPlayingVerse !== null &&
                        currentlyPlayingVerse.surahId === item.chapter_id &&
                        currentlyPlayingVerse.verseNumber === item.verse_number;
                      return (
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
                            tajweedText: item.tajweedText || undefined,
                          }}
                          onPlayAudio={handleVersePlayAudio}
                          surahMemorizedGlobally={false}
                          surahRevisedGlobally={false}
                          onSurahMemorizeToggle={() => { }}
                          onSurahRevisionToggle={() => { }}
                          source={'juzList'}
                          isCurrentlyPlaying={isPlaying}
                          juzSequenceNumber={index + 1}
                          totalJuzVerses={juzVerses.length}
                        />
                      );
                    }}
                    contentContainerStyle={[styles.versesContent, { backgroundColor: '#0B0E14' }]}
                  />
                )}
              </Animated.View>
            )}
          </View>
        ) : tab === 'surah' ? (
          <View style={{ flex: 1, position: 'relative' }}>
            <FlashList
              ref={surahListRef}
              data={filteredSurahs}
              renderItem={renderSurahItem}
              keyExtractor={(item: any) => `surah-${item.id}`}
              contentContainerStyle={[styles.surahListContent, { backgroundColor: '#0B0E14' }]}
              onScroll={handleSurahListScroll}
              scrollEventThrottle={16}
              {...({ estimatedItemSize: 80 } as any)}
            />
            <LinearGradient
              colors={['rgba(11, 14, 20, 0.8)', 'transparent']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 0.3 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '20%', pointerEvents: 'none' }}
            />
            <LinearGradient
              colors={['transparent', 'rgba(11, 14, 20, 0.8)']}
              start={{ x: 0.5, y: 0.7 }}
              end={{ x: 0.5, y: 1 }}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '20%', pointerEvents: 'none' }}
            />
          </View>
        ) : (
          <JuzMemorization onOpenJuz={handleSelectJuz} />
        )}
      </View>

      {/* Bottom Page Mode overlay (visible when Page Mode is active). Rendered outside modals and lists so it's always visible.) */}
      {/* Toast: small transient non-blocking feedback */}
      {toastMessage && (
        <Animated.View pointerEvents="none" style={[styles.toastContainer, { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
          <View style={styles.toastInner}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{toastMessage}</Text>
          </View>
        </Animated.View>
      )}

      {isPageModeActive && (
        <View style={styles.pageOverlay} pointerEvents="box-none">
          {/* close/exit Page Mode */}
          <TouchableOpacity testID="page-overlay-close" onPress={() => exitPageMode()} style={styles.pageOverlayClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.pageOverlayButton} onPress={handlePrevPage} activeOpacity={0.8}>
            <ArrowLeft size={20} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.pageOverlayCenter}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
              {pageModeScope === 'surah'
                ? `Page ${currentPageIndex + 1}/${surahPages?.length ?? 0}`
                : `Page ${currentPageIndex + 1}/${juzPages?.length ?? 0}`}
            </Text>
            <AutoSizeText
              numberOfLines={1}
              mode={ResizeTextMode.min_font_size}
              fontSize={12}
              minFontSize={10}
              style={{ color: '#aaa', marginTop: 4, maxWidth: '100%', textAlign: 'center' }}
            >
              {pageModeScope === 'surah'
                ? `${selectedSurah ? selectedSurah.englishName : 'Surah'} • ${pageModeSessionVpp} verses per page`
                : `Juz ${selectedJuz ?? '-'} • ${pageModeSessionVpp} verses per page`}
            </AutoSizeText>
            {/* Play control moved to header — overlay keeps navigation only */}
          </View>

          <TouchableOpacity style={styles.pageOverlayButton} onPress={handleNextPage} activeOpacity={0.8}>
            <ArrowRight size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}

      {/* CelebrationModal removed - now handled globally in _layout.tsx */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  // Slightly larger top padding to avoid overlap with navigation / status bars
  headerContainer: { paddingTop: 20, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: '#1a1a1a' },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, justifyContent: 'space-between', position: 'relative' },
  // Make title container a normal flex child so it occupies center space and does not overlap other items
  headerTitleContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#ffffff', textAlign: 'center' },
  headerSubtitle: { fontSize: 14, color: '#888888', marginTop: 2, textAlign: 'center' },
  // Move header action buttons further down so they don't overlap the title
  // Ensure header action buttons sit below the title (avoid overlapping small screens)
  headerActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingHorizontal: 8 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#505050', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8, marginHorizontal: 4 },
  actionButtonActive: { backgroundColor: '#4CAF50' },
  actionButtonRevised: { backgroundColor: '#FF9800' },
  actionButtonText: { color: '#ffffff', marginLeft: 4, fontSize: 11, fontWeight: '600' },
  versesContainer: { flex: 1, backgroundColor: '#1a1a1a' },
  versesContent: { padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#ffffff' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: '#1a1a1a' },
  errorText: { fontSize: 16, textAlign: 'center', marginBottom: 16, color: '#ff5252' },
  retryButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  retryButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  surahListContent: { padding: 16, backgroundColor: '#1a1a1a' },
  surahCard: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 12, borderRadius: 12, backgroundColor: '#333333', borderColor: '#555555', borderWidth: 1, elevation: 2 },
  surahNumber: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  surahNumberText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  surahInfo: { flex: 1, marginLeft: 12 },
  surahName: { fontSize: 18, fontWeight: '600', color: '#ffffff' },
  surahEnglish: { fontSize: 14, color: '#888888' },
  surahDetailsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  surahDetails: { fontSize: 14, color: '#888888' },
  progressPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  progressText: { color: '#ffffff', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  loadingMoreText: { marginTop: 8, fontSize: 14, color: '#888888' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: '#888888' },
  searchBarContainer: { padding: 16, paddingTop: 8, paddingBottom: 16, backgroundColor: '#1a1a1a' },
  searchInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333333', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 0, height: 36 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0, color: '#ffffff' },
  clearButton: { marginLeft: 8, padding: 2 },
  tabButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#333333' },
  tabText: { color: '#888888', fontWeight: '600' },
  tabTextActive: { color: '#ffffff' },
  khatamDate: { color: '#4CAF50', fontFamily: 'ScheherazadeNew-Regular', fontSize: 12, textAlign: 'right', marginLeft: 8 },
  verseList: { padding: 16, paddingBottom: 100 },
  pageOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    zIndex: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  pageOverlayButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  pageOverlayCenter: { flex: 1, alignItems: 'center' },
  pageOverlayClose: { position: 'absolute', top: 8, right: 8, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  toastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
    alignItems: 'center',
    zIndex: 80,
  },
  toastInner: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },

  // === Smart Progressive Header Styles ===
  smartHeader: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  smartHeaderMinimal: {
    paddingTop: 12,
    paddingBottom: 6,
  },
  smartHeaderCollapsed: {
    paddingTop: 8,
    paddingBottom: 4,
  },

  // Row 1: Always visible
  alwaysVisibleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    marginBottom: 4,
  },
  compactSurahNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#C5A059',
    marginRight: 4,
  },
  compactSurahName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginRight: 8,
    maxWidth: '35%',
  },
  compactSurahArabic: {
    fontSize: 16,
    fontFamily: 'ScheherazadeNew-Regular',
    color: '#C5A059',
    marginLeft: 4,
    flex: 1,
  },
  compactPlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#555',
  },
  expandButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },

  // Row 2: Removed in refined layout

  miniButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#555',
    marginLeft: 8,
  },

  // Row 3: Only in full state
  bulkActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 4,
    gap: 8,
  },
  bulkActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  bulkActionButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  bulkActionButtonRevised: {
    backgroundColor: '#FF9800',
    borderColor: '#FF9800',
    borderWidth: 2,
  },
  bulkActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 6,
  },
  headerSeparator: {
    height: 1,
    backgroundColor: '#333',
    marginTop: 8,
  },
});