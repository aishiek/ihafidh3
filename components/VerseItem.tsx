import { surahsData } from '@/data/surahs';
import { fetchTransliterationText } from '@/services/quranApi';
import { getTranslationRemote } from '@/services/remoteTranslation';
import { cacheGet, cacheSet } from '@/services/verseCache';
import { getVerseFromLocalDB } from '@/services/verseDbService';
import { useBookmarkStore } from '@/store/bookmarkStore';
import { useProgressStore } from '@/store/progressStore';
import { PLAYBACK_SPEED_OPTIONS, useSettingsStore, type PlaybackSpeed } from '@/store/settingsStore';
import { Verse } from '@/types';
import { setPlaybackSpeed as setAudioPlaybackSpeed } from '@/utils/audioUtils';
import { getArabicFontFamily, getArabicTypographySizing } from '@/utils/fontUtils';
import { useThemeColor } from '@/utils/useThemeColor';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Bookmark as BookmarkIcon, BookOpen, Check, Infinity as InfinityIcon, Play, RefreshCw } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import TafsirModal from './TafsirModal';
import TajweedText from './TajweedText';
// Direct import to avoid Suspense conflicts with FlashList
import SajdahIcon from '@/assets/svg/islamic-patterns/SajdahIcon';
import { isSajdah } from '@/utils/isSajdah';

interface VerseItemProps {
  verse: Verse;
  onPlayAudio?: (surahNum: number, verseNum: number, globalId?: number, repeats?: number, isInfinite?: boolean) => void;
  surahMemorizedGlobally?: boolean;
  surahRevisedGlobally?: boolean;
  onSurahMemorizeToggle?: () => void;
  onSurahRevisionToggle?: () => void;
  moveToVerse?: (verseNumber: number) => boolean | Promise<boolean>;
  isCurrentlyPlaying?: boolean;
  // Page mode playback visuals
  pageIsPlaying?: boolean;
  pageIsCompleted?: boolean;
  pageRepeatInfo?: string | undefined;
  juzSequenceNumber?: number;
  totalJuzVerses?: number;
  source?: 'surahList' | 'juzList' | 'mustahabbah';
}

type VerseItemInternalProps = VerseItemProps & { forwardedRef?: any };

const formatDate = (dateStr: string | null): string | null => {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  } catch (error) {
    console.error('[VerseItem] Date formatting failed:', error);
    return null;
  }
};

const getSurahId = (verse: Verse): number | null => {
  const surahId = verse.surahId || (verse as any).surahNumber || verse.surah?.number;
  return surahId || null;
};

const VerseItem = ({
  verse,
  onPlayAudio,
  surahMemorizedGlobally = false,
  surahRevisedGlobally = false,
  onSurahMemorizeToggle,
  onSurahRevisionToggle,
  forwardedRef,
  moveToVerse,
  source = 'surahList',
  isCurrentlyPlaying = false,
  pageIsPlaying = false,
  pageIsCompleted = false,
  pageRepeatInfo,
  juzSequenceNumber,
  totalJuzVerses,
  ...rest
}: VerseItemInternalProps) => {
  const { primary } = useThemeColor();

  // ============ SETTINGS STORE ============
  const {
    fontSizeArabic,
    fontSizeTransliteration,
    fontSizeTranslation,
    arabicFont,
    showTranslation,
    showTransliteration,
    repeatMode,
    playbackSpeed,
    infiniteLoop,
    translationLanguage
  } = useSettingsStore();

  // ============ PROGRESS STORE ============
  const memorizedVerseDates = useProgressStore(state => state.memorizedVerseDates);
  const memorizedVerses = useProgressStore(state => state.memorizedVerses);
  const revisedVerses = useProgressStore(state => state.revisedVerses);

  // ============ BOOKMARK STORE ============
  const bookmarksSet = useBookmarkStore(state => state.bookmarksSet);

  // ============ LOCAL STATE ============
  const [repeatCount, setRepeatCount] = useState<number>(repeatMode || 1);
  const [showPlaybackModal, setShowPlaybackModal] = useState(false);
  const [showTafsirModal, setShowTafsirModal] = useState(false);
  // per-verse Go modal (small, opens to jump to a verse via moveToVerse prop)
  const [showGoModal, setShowGoModal] = useState(false);
  const [goInput, setGoInput] = useState('');
  const [goInputError, setGoInputError] = useState<string | null>(null);
  const [goSubmitting, setGoSubmitting] = useState(false);
  const [remoteTransliteration, setRemoteTransliteration] = useState<string | null>(null);
  const [remoteTranslation, setRemoteTranslation] = useState<string | null>(null);
  const [localData, setLocalData] = useState({
    arabic: null as string | null,
    transliteration: null as string | null,
    translation: null as string | null,
  });
  const [localDataError, setLocalDataError] = useState<string | null>(null);

  // ============ REFS ============
  const bookmarkBusyRef = useRef(false);
  const transliterationAbortRef = useRef<AbortController | null>(null);
  const translationAbortRef = useRef<AbortController | null>(null);
  const localDbAbortRef = useRef<AbortController | null>(null);
  // CRITICAL: Track if component is mounted and visible
  const isMountedRef = useRef(true);
  const loadingStartedRef = useRef(false);

  // ============ CRITICAL FIX: Reset all local state when verse changes (Fix for FlashList recycling) ============
  useEffect(() => {
    // When the verse ID changes (component recycled to show different verse),
    // reset ALL local state to prevent showing old verse's content
    setRepeatCount(repeatMode || 1);
    setShowPlaybackModal(false);
    setShowTafsirModal(false);
    setShowGoModal(false);
    setGoInput('');
    setGoInputError(null);
    setGoSubmitting(false);
    setRemoteTransliteration(null);
    setRemoteTranslation(null);
    setLocalData({
      arabic: null,
      transliteration: null,
      translation: null,
    });
    setLocalDataError(null);

    // Reset loading flags to allow fresh data load
    loadingStartedRef.current = false;

    // Abort any pending async operations from previous verse
    transliterationAbortRef.current?.abort();
    translationAbortRef.current?.abort();
    localDbAbortRef.current?.abort();

  }, [verse.id, verse.surahId, verse.verseNumber, repeatMode]);

  // ============ DERIVED STATE ============
  const surahId = useMemo(() => getSurahId(verse), [verse.surahId, (verse as any).surahNumber, verse.surah?.number]);
  const memorized = useMemo(() => memorizedVerses.includes(verse.id), [memorizedVerses, verse.id]);
  const revised = useMemo(() => revisedVerses.some((v: any) => v.verseId === verse.id), [revisedVerses, verse.id]);
  const bookmarked = useMemo(() => bookmarksSet.has(verse.id), [bookmarksSet, verse.id]);

  // Memoize sajdah check to avoid recalculating on every render
  const isSajdahVerse = useMemo(() => {
    return isSajdah(surahId || 0, verse.verseNumber);
  }, [surahId, verse.verseNumber]);

  const memorizedDate = useMemo(() => {
    const date = memorizedVerseDates?.[verse.id];
    return formatDate(date);
  }, [memorizedVerseDates, verse.id]);

  const revisedDate = useMemo(() => {
    const entry = (revisedVerses || []).find((v: any) => v.verseId === verse.id);
    return formatDate(entry?.revisionDate || null);
  }, [revisedVerses, verse.id]);

  // ============ FONT & STYLING ============
  const arabicFamily = useMemo(() => getArabicFontFamily(arabicFont as any), [arabicFont]);
  const arabicTypography = useMemo(() => getArabicTypographySizing(fontSizeArabic, arabicFont as any), [fontSizeArabic, arabicFont]);

  // Only treat Bismillah as the verse text when this item represents an explicit
  // Bismillah verse (verseNumber === 0 or negative id used by DB). Do NOT fall
  // back to Bismillah for missing/empty arabicText — that caused Bismillah to
  // appear for unrelated verses when list items were recycled.
  const arabicText = useMemo(() => {
    const txt = typeof verse.arabicText === 'string' ? verse.arabicText.trim() : '';
    if (txt && txt.length > 0) return txt;
    // DB uses verseNumber === 0 or negative IDs for synthetic Bismillah entries
    const vnum = (verse as any).verseNumber;
    const vid = (verse as any).id;
    if (vnum === 0 || (typeof vid === 'number' && vid < 0)) {
      return 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
    }
    // No arabic text available — return empty string to avoid showing Bismillah
    return '';
  }, [verse.arabicText, (verse as any).verseNumber, (verse as any).id]);
  // No fallback translation for missing Arabic to avoid showing Bismillah text
  // incorrectly for other verses when data is missing.
  const defaultTranslation = '';

  // ============ DISPLAY VALUES ============
  // Prefer explicitly loaded local data; otherwise use computed arabicText.
  // If neither is present, show an empty string (prevents accidental Bismillah fallbacks).
  // NOTE: U+06DF (۟) marks are legitimate Quranic orthography that should be visible
  // React Native can't position them above letters (GPOS limitation) so they appear standalone
  const displayedArabic = useMemo(() => {
    let text = (() => {
      // CRITICAL: When Tajweed font is selected, use tajweedText with markup for colors
      if (arabicFont === 'tajweed' && (verse as any).tajweedText) {
        return (verse as any).tajweedText;
      }
      // Otherwise use plain text
      if (localData.arabic && localData.arabic.trim().length > 0) {
        return localData.arabic;
      }
      return arabicText || '';
    })();

    // Append decorative verse end glyph for Tajweed mode
    // The number decoration (۝) is appended as a single glyph.
    // The actual digits will be overlaid by the TajweedText component to ensure correct framing.
    // Defensive check: only append if the marker isn't already present (e.g. from parser cleaning)
    if (arabicFont === 'tajweed' && text && !text.endsWith('\u06DD')) {
      text = `${text}\u06DD`;
    }

    return text;
  }, [arabicFont, (verse as any).tajweedText, localData.arabic, arabicText]);

  // Simplified: prefer remote (English) transliteration when available, then local cache, then prop.
  const displayedTransliteration = useMemo(() => {
    if (remoteTransliteration != null) return remoteTransliteration;
    if (localData.transliteration) return localData.transliteration;
    return verse.transliteration || null;
  }, [remoteTransliteration, localData.transliteration, verse.transliteration]);

  const displayedTranslation = useMemo(() => {
    return remoteTranslation || localData.translation || verse.translation || defaultTranslation;
  }, [remoteTranslation, localData.translation, verse.translation, defaultTranslation]);

  // ============ CONTAINER STYLE ============
  const containerStyle = useMemo(() => {
    const isMemorized = memorized || surahMemorizedGlobally;
    const isRevised = revised || surahRevisedGlobally;

    // Page-mode PLAYING state takes precedence (blue)
    if (pageIsPlaying) {
      return {
        backgroundColor: '#1E3A8A',
        borderColor: '#3B82F6',
        borderWidth: 2,
      };
    }

    // Page-mode COMPLETED state (green border) has next precedence
    if (pageIsCompleted) {
      return {
        backgroundColor: '#1a1a1a',
        borderColor: '#10B981',
        borderWidth: 2,
      };
    }

    if (isMemorized && isRevised) {
      return {
        backgroundColor: '#4CAF5015',
        borderColor: '#4CAF50',
        borderWidth: 2,
        borderTopColor: '#4CAF50',
        borderBottomColor: '#FF9800',
        borderLeftColor: '#4CAF50',
        borderRightColor: '#FF9800',
      };
    }
    if (isMemorized) {
      return {
        backgroundColor: '#4CAF5020',
        borderColor: '#4CAF50',
        borderWidth: 2,
      };
    }
    if (isRevised) {
      return {
        backgroundColor: '#211f1e',
        borderColor: '#FF9800',
        borderWidth: 2,
      };
    }
    return {
      backgroundColor: '#1a1a1a',
      borderColor: '#ffffff',
      borderWidth: 1,
    };
  }, [memorized, surahMemorizedGlobally, revised, surahRevisedGlobally, pageIsPlaying, pageIsCompleted]);

  // ============ EVENT HANDLERS (using getState() to prevent re-renders) ============

  const handleToggleBookmark = useCallback(async () => {
    if (bookmarkBusyRef.current) return;
    try {
      bookmarkBusyRef.current = true;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });

      if (!bookmarked) {
        const arabicSnippet = (verse.arabicText || '').slice(0, 50);
        const translationSnippet = (verse.translation || '').slice(0, 100);
        // Normalize source: 'juzList' -> 'juz', 'surahList' -> 'surah'
        const normalizedSource = source === 'juzList' ? 'juz' : 'surah';
        const juzNum = source === 'juzList' ? verse.juzNumber : undefined;

        await useBookmarkStore.getState().addBookmark(
          verse.id,
          surahId || 0,
          (verse as any).surahName || verse.surah?.englishName || `Surah ${surahId || ''}`,
          verse.verseNumber,
          arabicSnippet,
          translationSnippet,
          normalizedSource,
          juzNum
        );
      } else {
        await useBookmarkStore.getState().removeBookmark(verse.id);
      }
    } catch (error) {
      console.error('[VerseItem] Bookmark toggle failed:', error);
    } finally {
      bookmarkBusyRef.current = false;
    }
  }, [bookmarked, verse, surahId, source]);

  const handleMarkMemorized = useCallback(() => {
    try {
      if (memorized) {
        useProgressStore.getState().unmarkVerseAsMemorized(verse.id);
      } else {
        useProgressStore.getState().markVerseAsMemorized(verse.id);
        // Check for badge unlocks after marking as memorized
        setTimeout(() => {
          useProgressStore.getState().checkAndCelebrateBadges();
        }, 100);
      }
    } catch (error) {
      console.error('[VerseItem] Mark memorized failed:', error);
    }
  }, [memorized, verse.id]);

  const handleMarkRevised = useCallback(() => {
    try {
      if (revised) {
        useProgressStore.getState().unmarkVerseAsRevised(verse.id);
      } else {
        useProgressStore.getState().markVerseAsRevised(verse.id);
      }
    } catch (error) {
      console.error('[VerseItem] Mark revised failed:', error);
    }
  }, [revised, verse.id]);

  const handlePlaybackSpeedPress = useCallback((speed: PlaybackSpeed) => {
    try {
      useSettingsStore.getState().setPlaybackSpeed(speed);
      setAudioPlaybackSpeed(speed).catch(error => {
        console.warn('[VerseItem] Audio playback speed update failed:', error);
      });
    } catch (error) {
      console.error('[VerseItem] Playback speed change failed:', error);
    }
  }, []);

  const handleToggleInfiniteLoop = useCallback(() => {
    try {
      useSettingsStore.getState().setInfiniteLoop(!infiniteLoop);
      if (!infiniteLoop) {
        setRepeatCount(1);
      }
    } catch (error) {
      console.error('[VerseItem] Toggle infinite loop failed:', error);
    }
  }, [infiniteLoop]);

  const handleRepeatCountChange = useCallback((count: number) => {
    try {
      setRepeatCount(count);
      useSettingsStore.getState().setRepeatMode(count);
      useSettingsStore.getState().setInfiniteLoop(false);
    } catch (error) {
      console.error('[VerseItem] Repeat count change failed:', error);
    }
  }, []);

  const handlePlayAudio = useCallback(() => {
    try {
      if (!onPlayAudio) return;
      const surahNum = surahId || 0;
      const verseNum = verse.verseNumber || 0;
      onPlayAudio(surahNum, verseNum, undefined, repeatCount, infiniteLoop);
    } catch (error) {
      console.error('[VerseItem] Play audio failed:', error);
    }
  }, [onPlayAudio, surahId, verse.verseNumber, repeatCount, infiniteLoop]);

  // ============ EFFECTS ============

  // Load verse data from local DB
  useEffect(() => {
    if (!surahId || loadingStartedRef.current) return;

    isMountedRef.current = true;
    loadingStartedRef.current = true;

    const controller = new AbortController();
    localDbAbortRef.current = controller;

    // CRITICAL FIX: Debounce to avoid rapid loading during fast scrolls
    const timeoutId = setTimeout(async () => {
      if (!isMountedRef.current || controller.signal.aborted) return;

      try {
        const cachedArabic = cacheGet<string>(surahId, verse.verseNumber, 'local_ar');
        const cachedTranslit = cacheGet<string>(surahId, verse.verseNumber, 'local_tr');
        const cachedTrans = cacheGet<string>(surahId, verse.verseNumber, 'local_en');

        if (cachedArabic || cachedTranslit || cachedTrans) {
          if (isMountedRef.current && !controller.signal.aborted) {
            setLocalData({
              arabic: cachedArabic || null,
              transliteration: cachedTranslit || null,
              translation: cachedTrans || null,
            });
            setLocalDataError(null);
          }
          loadingStartedRef.current = false;
          return;
        }

        const row = await getVerseFromLocalDB(surahId, verse.verseNumber);

        if (!isMountedRef.current || controller.signal.aborted) return;

        if (!row) {
          setLocalDataError('Verse not found in local DB');
          setLocalData({
            arabic: null,
            transliteration: null,
            translation: null,
          });
          loadingStartedRef.current = false;
          return;
        }

        setLocalData({
          arabic: row.ayah || null,
          transliteration: row.transliteration || null,
          translation: row.translation || null,
        });
        setLocalDataError(null);

        if (row.ayah) cacheSet(surahId, verse.verseNumber, 'local_ar', row.ayah);
        if (row.transliteration) cacheSet(surahId, verse.verseNumber, 'local_tr', row.transliteration);
        if (row.translation) cacheSet(surahId, verse.verseNumber, 'local_en', row.translation);
      } catch (error) {
        if (!controller.signal.aborted && isMountedRef.current) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.warn('[VerseItem] Local DB load failed:', errorMsg);
          setLocalDataError(errorMsg);
        }
      } finally {
        loadingStartedRef.current = false;
      }
    }, 100); // 100ms debounce - critical for smooth scrolling

    return () => {
      clearTimeout(timeoutId);
      isMountedRef.current = false;
      controller.abort();
    };
  }, [surahId, verse.verseNumber]);  // Load remote transliteration
  useEffect(() => {
    if (!surahId || !showTransliteration) {
      setRemoteTransliteration(null);
      return;
    }

    isMountedRef.current = true;
    const controller = new AbortController();
    transliterationAbortRef.current = controller;

    // CRITICAL FIX: Debounce remote API calls
    const timeoutId = setTimeout(async () => {
      if (!isMountedRef.current || controller.signal.aborted) return;

      try {
        const text = await fetchTransliterationText(surahId, verse.verseNumber, 'en');
        if (isMountedRef.current && !controller.signal.aborted) {
          setRemoteTransliteration(text || null);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn('[VerseItem] Remote transliteration load failed:', error);
          setRemoteTransliteration(null);
        }
      }
    }, 150); // Slightly longer debounce for remote calls

    return () => {
      clearTimeout(timeoutId);
      isMountedRef.current = false;
      controller.abort();
    };
  }, [surahId, verse.verseNumber, showTransliteration, translationLanguage]);

  // Load remote translation
  useEffect(() => {
    if (!surahId) {
      setRemoteTranslation(null);
      return;
    }

    const langBase = (translationLanguage || '').split('.')[0].toLowerCase();
    if (langBase === 'en') {
      setRemoteTranslation(null);
      return;
    }

    isMountedRef.current = true;
    const controller = new AbortController();
    translationAbortRef.current = controller;

    // CRITICAL FIX: Debounce remote API calls
    const timeoutId = setTimeout(async () => {
      if (!isMountedRef.current || controller.signal.aborted) return;

      try {
        const cached = cacheGet<string>(surahId, verse.verseNumber, translationLanguage);
        if (cached) {
          if (isMountedRef.current && !controller.signal.aborted) {
            setRemoteTranslation(cached);
          }
          return;
        }

        const remote = await getTranslationRemote(surahId, verse.verseNumber, translationLanguage);
        if (isMountedRef.current && !controller.signal.aborted && remote) {
          setRemoteTranslation(remote);
          cacheSet(surahId, verse.verseNumber, translationLanguage, remote);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn('[VerseItem] Remote translation load failed:', error);
          setRemoteTranslation(null);
        }
      }
    }, 150); // Debounce remote API calls

    return () => {
      clearTimeout(timeoutId);
      isMountedRef.current = false;
      controller.abort();
    };
  }, [surahId, verse.verseNumber, translationLanguage]);

  // Cleanup all abort controllers on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      transliterationAbortRef.current?.abort();
      translationAbortRef.current?.abort();
      localDbAbortRef.current?.abort();
    };
  }, []);

  // DB connection management has been moved to the parent component (read.tsx)
  // to avoid multiple listeners and improve performance

  // Sync repeatCount with repeatMode from store
  useEffect(() => {
    if (repeatMode && repeatMode !== repeatCount) {
      setRepeatCount(repeatMode);
    }
  }, [repeatMode, repeatCount]);

  // Get Surah name for Juz mode
  const getSurahName = () => {
    if (source === 'juzList') {
      // For Juz mode, use Arabic name in English (e.g., "Al-Fatihah" not "The Opening")
      const chapterId = (verse as any).chapter_id || verse.surahId;
      const surah = surahsData.find(s => s.id === chapterId);
      // prefer englishName, then name; avoid undefined showing in UI
      const surahName = surah ? (surah.englishName || surah.name) : undefined;
      const surahInfo = surahName ? `${chapterId}: ${surahName}` : `Surah ${chapterId}`;

      // Add sequence number if available (using != null to catch both null and undefined)
      if (juzSequenceNumber != null && totalJuzVerses != null) {
        return `${surahInfo} • ${juzSequenceNumber}/${totalJuzVerses}`;
      }
      return surahInfo;
    }

    // For Surah mode, show Juz and page number instead of redundant surah info
    const juz = verse.juzNumber;
    const page = verse.pageNumber;

    if (juz && page) {
      return `Juz:${juz} pg:${page}`;
    } else if (juz) {
      return `Juz:${juz}`;
    } else if (page) {
      return `pg:${page}`;
    }

    // Fallback to surah name if juz/page not available
    const surahName = (verse as any).surahName || verse.surah?.englishName || `Surah ${surahId || ''}`;
    return surahName;
  };

  // Compute number string info for responsive sizing (prevents wrapping for 3-digit numbers)
  const verseNumberStr = String(verse.verseNumber ?? '');
  const isThreeDigits = verseNumberStr.length >= 3;

  // Determine if we should show the legacy verse number badge
  // We hide it if we are in Tajweed mode and have a decorative Mushaf symbol as the primary marker
  const showLegacyVerseNumber = !(arabicFont === 'tajweed' && displayedArabic.endsWith('\u06DD'));

  return (
    <Pressable ref={forwardedRef as any} style={[styles.container, containerStyle]}>
      <View style={styles.header}>
        {showLegacyVerseNumber && (
          <View style={[
            styles.verseNumber,
            { backgroundColor: primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: isThreeDigits ? 8 : 6, minWidth: isThreeDigits ? 36 : 28 },
          ]}>
            <Text style={[styles.verseNumberText, { color: '#ffffff', fontSize: isThreeDigits ? 8 : styles.verseNumberText.fontSize, textAlign: 'center' }]} numberOfLines={1}>
              {verse.verseNumber}
            </Text>
            {pageIsCompleted && (
              <View style={{ marginLeft: 6, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={14} color="#10B981" />
              </View>
            )}
          </View>
        )}

        <View style={styles.verseInfo}>
          <Text
            style={[styles.verseInfoText, { color: '#ffffff' }]}
            numberOfLines={1}
            ellipsizeMode="tail"
            adjustsFontSizeToFit={true}
            minimumFontScale={0.75}
          >
            {getSurahName()}
          </Text>
        </View>

        {/* Right-aligned controls group with minimal spacing */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open tafsir"
            style={[styles.controlButton, styles.subtleGoldBg, { marginLeft: 4 }]}
            onPress={() => setShowTafsirModal(true)}
          >
            <BookOpen size={18} color="#FFD700" />
          </TouchableOpacity>

          <Pressable
            style={({ pressed }) => [
              styles.bookmarkButton,
              bookmarked && { backgroundColor: '#333333' },
              pressed && { opacity: 0.6 },
              { marginLeft: 4 }
            ]}
            onPress={handleToggleBookmark}
            accessibilityRole="button"
            accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
          >
            <BookmarkIcon size={16} color={bookmarked ? '#FFD700' : '#888888'} fill={bookmarked ? '#FFD700' : 'transparent'} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.audioButton,
              {
                backgroundColor: isCurrentlyPlaying ? '#666666' : primary,
                marginLeft: 4,
                opacity: pressed ? 0.7 : 1,
              }
            ]}
            onPress={handlePlayAudio}
            accessibilityRole="button"
            accessibilityLabel={isCurrentlyPlaying ? 'Playing verse audio' : 'Play verse audio'}
            disabled={isCurrentlyPlaying}
          >
            <Play size={16} color="#ffffff" fill={isCurrentlyPlaying ? '#ffffff' : 'transparent'} />
          </Pressable>

          {/* Repeat Mode Button */}
          <Pressable
            style={({ pressed }) => [
              styles.repeatButton,
              {
                backgroundColor: 'rgba(255, 215, 0, 0.15)',
                borderColor: 'rgba(255, 215, 0, 0.3)',
                borderWidth: 1,
                marginLeft: 4,
                opacity: pressed ? 0.7 : 1,
              }
            ]}
            onPress={() => setShowPlaybackModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Playback settings"
          >
            {infiniteLoop ? (
              <InfinityIcon size={14} color="#FFD700" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <RefreshCw size={14} color="#FFD700" />
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFD700', marginLeft: 2 }}>
                  {repeatCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
        {/* Go-to-verse UI removed from per-verse item; centralized in Surah header */}
      </View>

      {pageIsPlaying && (
        <View style={{ marginTop: 8, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1E3A8A', borderColor: '#3B82F6', borderWidth: 1, alignSelf: 'flex-start' }}>
          <Text style={{ color: '#e6f0ff', fontWeight: '700' }}>🔊 Playing{pageRepeatInfo ? ` ${pageRepeatInfo}` : ''}</Text>
        </View>
      )}

      {/* Inline container so we can place an inline sajdah icon at the end of the verse */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          {arabicFont === 'tajweed' ? (
            <TajweedText
              text={displayedArabic}
              surahNumber={surahId || undefined}
              verseNumber={verse.verseNumber}
              allowFontScaling={false}
              style={[{
                color: '#ffffff',
                fontFamily: arabicFamily,
                includeFontPadding: false,
                paddingHorizontal: 4,
                ...arabicTypography,
                minHeight: arabicTypography.lineHeight || fontSizeArabic * 1.5, // Fallback for short verses
                lineHeight: arabicTypography.lineHeight || Math.round(fontSizeArabic * 2.0),
              }]}
            />
          ) : (
            <Text
              allowFontScaling={false}
              style={[{
                color: '#ffffff',
                fontFamily: arabicFamily,
                includeFontPadding: false,
                paddingHorizontal: 4,
                ...arabicTypography,
                lineHeight: arabicTypography.lineHeight || Math.round(fontSizeArabic * 2.0),
              }]}
            >
              {displayedArabic}
            </Text>
          )}
        </View>

        {/* Visual indicator for Sajdah verses - no interaction to prevent freezing */}
        {isSajdahVerse && !!displayedArabic && (
          <View
            accessibilityLabel="Sajdah verse"
            style={{
              paddingLeft: 8,
              paddingTop: 2,
            }}
          >
            <SajdahIcon size={18} color="#FFD700" />
          </View>
        )}
      </View>

      {showTransliteration && !!displayedTransliteration && (
        <Text style={{
          color: '#FFD700',
          fontSize: fontSizeTransliteration,
          marginTop: 8,
        }}>
          {displayedTransliteration}
        </Text>
      )}

      {showTranslation && !!displayedTranslation && (
        <Text style={{
          color: '#ffffff',
          fontSize: fontSizeTranslation,
          marginTop: 4,
        }}>
          {displayedTranslation}
        </Text>
      )}

      <View style={styles.datesRow}>
        <View style={[styles.dateCol, { opacity: (memorized || surahMemorizedGlobally) ? 1 : 0.5 }]}>
          {memorized && !!memorizedDate && (
            <Text style={[styles.memorizedDateText]}>Memorized: {memorizedDate}</Text>
          )}
          {surahMemorizedGlobally && !memorized && (
            <Text style={[styles.memorizedDateText]}>Memorized: (Surah level)</Text>
          )}
          {!memorized && !surahMemorizedGlobally && (
            <Text style={[styles.memorizedDateText, { opacity: 0.3 }]}>Not memorized</Text>
          )}
        </View>

        <View style={[styles.dateCol, { opacity: (revised || surahRevisedGlobally) ? 1 : 0.5 }]}>
          {revised && !!revisedDate && (
            <Text style={[styles.revisedDateText]}>Revised: {revisedDate}</Text>
          )}
          {surahRevisedGlobally && !revised && (
            <Text style={[styles.revisedDateText]}>Revised: (Surah level)</Text>
          )}
          {!revised && !surahRevisedGlobally && (
            <Text style={[styles.revisedDateText, { opacity: 0.3 }]}>Not revised</Text>
          )}
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <Pressable
          style={({ pressed }) => ({
            flex: 1,
            marginHorizontal: 4,
            paddingVertical: 9,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: memorized ? '#4CAF50' : '#1a1a1a',
            borderColor: memorized ? '#4CAF50' : '#444444',
            borderWidth: memorized ? 2 : 1,
            opacity: pressed ? 0.7 : 1,
            shadowColor: memorized ? '#4CAF50' : 'transparent',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: memorized ? 3 : 0,
          })}
          onPress={handleMarkMemorized}
          android_ripple={{ color: 'transparent' }}
          accessibilityRole="button"
          accessibilityLabel={memorized ? 'Unmark as memorized' : 'Mark as memorized'}
        >
          <Check size={16} color="#ffffff" />
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#ffffff', marginLeft: 6 }}>
            {memorized ? 'Memorized' : 'Mark Memorized'}
          </Text>
          {memorized && (
            <View style={{
              marginLeft: 4,
              padding: 4,
              borderRadius: 12,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              width: 20,
              height: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <ArrowLeft size={12} color="#ffffff" />
            </View>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => ({
            flex: 1,
            marginHorizontal: 4,
            paddingVertical: 9,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: revised ? '#FF9800' : '#1a1a1a',
            borderColor: revised ? '#FF9800' : '#444444',
            borderWidth: revised ? 2 : 1,
            opacity: pressed ? 0.7 : 1,
            shadowColor: revised ? '#FF9800' : 'transparent',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: revised ? 3 : 0,
          })}
          onPress={handleMarkRevised}
          android_ripple={{ color: 'transparent' }}
          accessibilityRole="button"
          accessibilityLabel={revised ? 'Unmark as revised' : 'Mark as revised'}
        >
          <RefreshCw size={16} color="#ffffff" />
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#ffffff', marginLeft: 6 }}>
            {revised ? 'Revised' : 'Mark Revision'}
          </Text>
          {revised && (
            <View style={{
              marginLeft: 4,
              padding: 4,
              borderRadius: 12,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              width: 20,
              height: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <ArrowLeft size={12} color="#ffffff" />
            </View>
          )}
        </Pressable>
      </View>

      <Modal
        visible={showPlaybackModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPlaybackModal(false)}
        supportedOrientations={['portrait']}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowPlaybackModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Playback Settings</Text>

            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Repeat</Text>
              <View style={styles.optionsContainer}>
                {[1, 2, 3, 5, 7, 10].map(count => (
                  <TouchableOpacity
                    key={`repeat-${count}`}
                    style={[
                      styles.optionButton,
                      repeatCount === count && !infiniteLoop && styles.optionButtonSelected
                    ]}
                    onPress={() => handleRepeatCountChange(count)}
                    accessibilityRole="button"
                    accessibilityLabel={`Repeat ${count} times`}
                  >
                    <Text style={styles.optionButtonText}>
                      {count}x {repeatCount === count && !infiniteLoop && '✓'}
                    </Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    infiniteLoop && styles.optionButtonSelected
                  ]}
                  onPress={handleToggleInfiniteLoop}
                  accessibilityRole="button"
                  accessibilityLabel="Infinite loop"
                >
                  <InfinityIcon size={18} color={infiniteLoop ? '#fff' : '#888'} />
                  <Text style={[styles.optionButtonText, { marginLeft: 4 }]}>
                    ∞ {infiniteLoop && '✓'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Playback Speed</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.speedOptionsContainer}
              >
                {PLAYBACK_SPEED_OPTIONS.map(speed => (
                  <TouchableOpacity
                    key={`speed-${speed}`}
                    style={[
                      styles.speedOption,
                      playbackSpeed === speed && styles.speedOptionSelected
                    ]}
                    onPress={() => handlePlaybackSpeedPress(speed)}
                    accessibilityRole="button"
                    accessibilityLabel={`Playback speed ${speed}x`}
                  >
                    <Text style={styles.speedOptionText}>
                      {speed}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowPlaybackModal(false)}
              accessibilityRole="button"
              accessibilityLabel="Close playback settings"
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Done</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Small per-verse Go modal (uses moveToVerse if supplied) */}
      <Modal
        visible={showGoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGoModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowGoModal(false)}
        >
          <View style={[styles.modalContent, { maxWidth: 320 }]} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Go to verse</Text>
            <Text style={{ color: '#ccc', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>Enter verse number</Text>
            <TextInput
              value={goInput}
              onChangeText={(t) => { setGoInput(t); setGoInputError(null); }}
              keyboardType="number-pad"
              placeholder="Verse number"
              placeholderTextColor="#666"
              style={{ backgroundColor: '#151515', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: goInputError ? '#ff6b6b' : '#374151', textAlign: 'center', marginBottom: 8 }}
            />
            {goInputError ? <Text style={{ color: '#ff6b6b', marginBottom: 8, textAlign: 'center' }}>{goInputError}</Text> : null}

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <TouchableOpacity onPress={() => { setShowGoModal(false); setGoInput(''); setGoInputError(null); }} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#374151', marginRight: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  setGoInputError(null);
                  const n = parseInt(goInput.trim(), 10);
                  const maxVerse = (verse as any).surah?.versesCount || (verse as any).surah?.verses?.length || 9999;
                  if (!n || n < 1 || n > maxVerse) {
                    setGoInputError(`Enter a number between 1 and ${maxVerse}`);
                    return;
                  }
                  if (!moveToVerse) {
                    setGoInputError('Navigation handler not available');
                    return;
                  }
                  try {
                    setGoSubmitting(true);
                    const res = await moveToVerse(n as number);
                    if (res === false) {
                      // allow moveToVerse implementer to fallback. show a simple message
                      Alert.alert('Jump failed', `Could not jump to verse ${n}.`);
                    }
                    setShowGoModal(false);
                    setGoInput('');
                  } catch (err) {
                    console.warn('[VerseItem] moveToVerse failed:', err);
                    setGoInputError('Failed to jump.');
                  } finally {
                    setGoSubmitting(false);
                  }
                }}
                disabled={goSubmitting}
                style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#4a90e2' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>{goSubmitting ? 'Going...' : 'Go'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Go-to-verse UI removed from per-verse item; centralized in Surah header */}

      <TafsirModal
        visible={showTafsirModal}
        onClose={() => setShowTafsirModal(false)}
        surahId={surahId || 1}
        verseNumber={verse.verseNumber}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  verseNumber: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verseNumberText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  verseInfo: {
    flex: 1,
    marginLeft: 8,
    marginRight: 4, // Add small margin to prevent crowding with buttons
  },
  verseInfoText: {
    fontSize: 11.5, // Reduced from 12 for better fit on small screens
    opacity: 0.8,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  audioButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  repeatButton: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginLeft: 4,
  },
  bookmarkButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    backgroundColor: 'transparent',
  },
  controlButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    marginLeft: 8,
  },
  subtleGoldBg: {
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderColor: 'rgba(255, 215, 0, 0.25)',
  },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  dateCol: {
    width: '48%',
    alignItems: 'center',
  },
  memorizedDateText: {
    color: '#4CAF50',
    fontFamily: 'ScheherazadeNew-Regular',
    textAlign: 'center',
    marginBottom: 2,
    fontSize: 12,
  },
  revisedDateText: {
    color: '#FF9800',
    fontFamily: 'ScheherazadeNew-Regular',
    textAlign: 'center',
    marginBottom: 2,
    fontSize: 12,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 350,
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  optionButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#333',
    margin: 4,
    minWidth: 50,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  optionButtonSelected: {
    backgroundColor: '#4a90e2',
  },
  optionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  speedOptionsContainer: {
    paddingVertical: 8,
  },
  speedOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#333',
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedOptionSelected: {
    backgroundColor: '#4a90e2',
  },
  speedOptionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  modalCloseButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#4a90e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Export without memo - FlashList handles optimization via cell recycling
// Memo was blocking juzSequenceNumber and totalJuzVerses props from updating
export default VerseItem;