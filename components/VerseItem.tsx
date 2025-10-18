import { surahsData } from '@/data/surahs';
import { getTranslationRemote } from '@/services/remoteTranslation';
import { cacheGet, cacheSet } from '@/services/verseCache';
import { getVerseFromLocalDB } from '@/services/verseDbService';
import { useBookmarkStore } from '@/store/bookmarkStore';
import { useProgressStore } from '@/store/progressStore';
import { PLAYBACK_SPEED_OPTIONS, useSettingsStore, type PlaybackSpeed } from '@/store/settingsStore';
import { setPlaybackSpeed as setAudioPlaybackSpeed } from '@/utils/audioUtils';
import { Verse } from '@/types';
import { getArabicFontFamily, getArabicTypographySizing } from '@/utils/fontUtils';
import { useThemeColor } from '@/utils/useThemeColor';
import * as Haptics from 'expo-haptics';
import { Bookmark as BookmarkIcon, BookOpen, Infinity as InfinityIcon, Play, Repeat, X as XIcon } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TajweedVerse from 'rn-tajweed-verse';
import TafsirModal from './TafsirModal';

interface VerseItemProps {
  verse: Verse;
  // Parent will handle audio generation & playback. Provide surah/verse/global id when play pressed.
  onPlayAudio?: (surahNum: number, verseNum: number, globalId?: number, repeats?: number, isInfinite?: boolean) => void;
  // Global/Surah-level state and handlers
  surahMemorizedGlobally?: boolean;
  surahRevisedGlobally?: boolean;
  onSurahMemorizeToggle?: () => void;
  onSurahRevisionToggle?: () => void;
}

// Simple date formatter - converts ISO date to readable format
const formatDate = (dateStr: string | null): string | null => {
  if (!dateStr) return null;
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  } catch {
    return null;
  }
};

const VerseItem = ({
  verse,
  onPlayAudio,
  surahMemorizedGlobally = false,
  surahRevisedGlobally = false,
  onSurahMemorizeToggle,
  onSurahRevisionToggle,
}: VerseItemProps) => {
  const { primary } = useThemeColor();
  const { 
    fontSizeArabic, 
    fontSizeTransliteration, 
    fontSizeTranslation, 
    arabicFont, 
    showTranslation, 
    showTransliteration, 
    repeatMode, 
    setRepeatMode,
    playbackSpeed,
    setPlaybackSpeed: setStorePlaybackSpeed,
    infiniteLoop,
    setInfiniteLoop
  } = useSettingsStore();
  // Audio playback is handled by parent. VerseItem no longer generates URLs or auto-loads audio.
  // Derive memorized/revised status directly from stores for accuracy
  const memorizedVerseDates = useProgressStore(state => state.memorizedVerseDates);
  const memorizedVerses = useProgressStore(state => state.memorizedVerses);
  const revisedVerses = useProgressStore(state => state.revisedVerses);
  const markVerseAsMemorized = useProgressStore(state => state.markVerseAsMemorized);
  const unmarkVerseAsMemorized = useProgressStore(state => state.unmarkVerseAsMemorized);
  const markVerseAsRevised = useProgressStore(state => state.markVerseAsRevised);
  const unmarkVerseAsRevised = useProgressStore(state => state.unmarkVerseAsRevised);
  
  // Individual verse state (not affected by surah-level)
  const memorized = memorizedVerses.includes(verse.id);
  const revised = revisedVerses.some(v => v.verseId === verse.id);
  
  // Get dates for display - memoized to avoid recalculation
  const memorizedDate = useMemo(() => {
    const date = memorizedVerseDates?.[verse.id];
    return formatDate(date);
  }, [memorizedVerseDates, verse.id]);
  
  const revisedDate = useMemo(() => {
    const entry = revisedVerses.find(v => v.verseId === verse.id);
    return formatDate(entry?.revisionDate || null);
  }, [revisedVerses, verse.id]);
  const [repeatCount, setRepeatCount] = useState(repeatMode || 1);
  const [showPlaybackModal, setShowPlaybackModal] = useState(false);
  const [showTafsirModal, setShowTafsirModal] = useState(false);
  const addBookmark = useBookmarkStore(state => state.addBookmark);
  const removeBookmark = useBookmarkStore(state => state.removeBookmark);
  const bookmarksSet = useBookmarkStore(state => state.bookmarksSet);
  const bookmarked = useMemo(() => bookmarksSet.has(verse.id), [bookmarksSet, verse.id]);

  // Play action is delegated to parent via onPlayAudio prop. No audio work here.

  const bookmarkBusyRef = useRef(false);
  const handleToggleBookmark = useCallback(async () => {
    try {
      if (bookmarkBusyRef.current) return;
      bookmarkBusyRef.current = true;
      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      if (!bookmarked) {
        const arabicSnippet = (verse.arabicText || '').slice(0, 50);
        const translationSnippet = (verse.translation || '').slice(0, 100);
        await addBookmark(
          verse.id,
          verse.surahId || verse.surahNumber || 0,
          (verse as any).surahName || verse.surah?.englishName || `Surah ${verse.surahId || verse.surahNumber || ''}`,
          verse.verseNumber,
          arabicSnippet,
          translationSnippet
        );
      } else {
        await removeBookmark(verse.id);
      }
    } catch (e) {
      // Silent fail
    } finally {
      setTimeout(() => { bookmarkBusyRef.current = false; }, 150);
    }
  }, [bookmarked, addBookmark, removeBookmark, verse]);

  // No local audio cleanup needed; parent handles audio lifecycle.

  const handleMarkMemorized = useCallback(() => { 
    // Simple toggle: only mark/unmark individual verse using store directly
    if (memorized) {
      unmarkVerseAsMemorized(verse.id);
    } else {
      markVerseAsMemorized(verse.id);
    }
  }, [memorized, verse.id, markVerseAsMemorized, unmarkVerseAsMemorized]);

  const handleMarkRevised = useCallback(() => { 
    // Simple toggle: only mark/unmark individual verse using store directly
    if (revised) {
      unmarkVerseAsRevised(verse.id);
    } else {
      markVerseAsRevised(verse.id);
    }
  }, [revised, verse.id, markVerseAsRevised, unmarkVerseAsRevised]);

  const handlePlaybackSpeedPress = useCallback(async (speed: PlaybackSpeed) => {
    setStorePlaybackSpeed(speed);
    // Also update the currently loaded audio player (if any)
    try {
      await setAudioPlaybackSpeed(speed);
    } catch (e) {
      // swallow errors from audio util - store update already applied
      console.warn('[VerseItem] failed to set audio playback speed:', e);
    }
  }, [setStorePlaybackSpeed]);

  const toggleInfiniteLoop = useCallback(() => {
    const newInfiniteLoop = !infiniteLoop;
    setInfiniteLoop(newInfiniteLoop);
  }, [infiniteLoop, setInfiniteLoop]);

  useEffect(() => {
    if (repeatMode && repeatMode !== repeatCount) {
      setRepeatCount(repeatMode);
    }
  }, [repeatMode]);

  const arabicFamily = getArabicFontFamily(arabicFont as any);
  const arabicTypography = getArabicTypographySizing(fontSizeArabic, arabicFont as any);
  const arabicText = verse.arabicText?.trim() || 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
  const translation = verse.translation?.trim() || 'In the name of Allah, the Entirely Merciful, the Especially Merciful.';
  const transliteration = verse.transliteration?.trim();
  const { translationLanguage } = useSettingsStore();
  const surahMeta = useMemo(() => {
    if (verse?.surah) {
      return {
        revelationType: verse.surah.revelationType,
        numberOfAyahs: verse.surah.numberOfAyahs,
      };
    }
    const lookupId = verse.surahId ?? verse.surahNumber;
    if (!lookupId) return null;
    const fallback = surahsData.find(s => s.id === lookupId);
    if (!fallback) return null;
    return {
      revelationType: fallback.revelationType,
      numberOfAyahs: fallback.versesCount,
    };
  }, [verse]);

  // Determine if verse is marked (individual OR surah-level)
  const isMemorizedAnywhere = memorized || surahMemorizedGlobally;
  const isRevisedAnywhere = revised || surahRevisedGlobally;

  // PERFORMANCE: Memoize Arabic text style to avoid recreation
  const arabicTextStyle = useMemo(() => ({
    color: '#ffffff',
    fontFamily: arabicFamily,
    includeFontPadding: false,
    paddingHorizontal: 4,
    ...arabicTypography,
    lineHeight: arabicTypography.lineHeight || Math.round(fontSizeArabic * 2.0),
  }), [arabicFamily, arabicTypography, fontSizeArabic]);

  // PERFORMANCE: Memoize action button styles
  const memorizedButtonStyle = useMemo(() => ({
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center' as const,
    backgroundColor: memorized ? '#4CAF50' : '#000000',
    borderColor: memorized ? '#4CAF50' : '#ffffff',
    borderWidth: memorized ? 2 : 1,
  }), [memorized]);

  const revisedButtonStyle = useMemo(() => ({
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center' as const,
    backgroundColor: revised ? '#FF9800' : '#000000',
    borderColor: revised ? '#FF9800' : '#ffffff',
    borderWidth: revised ? 2 : 1,
  }), [revised]);

  const memorizedTextStyle = useMemo(() => ({
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ffffff',
  }), []);

  const revisedTextStyle = useMemo(() => ({
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ffffff',
  }), []);

  // PERFORMANCE: Memoize transliteration and translation styles
  const transliterationTextStyle = useMemo(() => ({
    color: '#FFD700',
    fontSize: fontSizeTransliteration,
    marginTop: 8,
  }), [fontSizeTransliteration]);

  const translationTextStyle = useMemo(() => ({
    color: '#ffffff',
    fontSize: fontSizeTranslation,
    marginTop: 4,
  }), [fontSizeTranslation]);

  // PERFORMANCE: Memoize container style to avoid recalculation on every render
  const containerStyle = useMemo(() => {
    if (isMemorizedAnywhere && isRevisedAnywhere) {
      return {
        backgroundColor: '#4CAF5015',
        borderColor: '#4CAF50',
        borderWidth: 2,
        borderTopColor: '#4CAF50',
        borderBottomColor: '#FF9800',
        borderLeftColor: '#4CAF50',
        borderRightColor: '#FF9800',
      };
    } else if (isMemorizedAnywhere) {
      return {
        backgroundColor: '#4CAF5020',
        borderColor: '#4CAF50',
        borderWidth: 2,
      };
    } else if (isRevisedAnywhere) {
      return {
        backgroundColor: '#211f1e',
        borderColor: '#FF9800',
        borderWidth: 2,
      };
    } else {
      return {
        backgroundColor: '#1a1a1a',
        borderColor: '#ffffff',
        borderWidth: 1,
      };
    }
  }, [isMemorizedAnywhere, isRevisedAnywhere]);

  // Local DB loader: attempt to load local Arabic/transliteration when possible
  const [localArabic, setLocalArabic] = useState<string | null>(null);
  const [localTransliteration, setLocalTransliteration] = useState<string | null>(null);
  const [localTranslation, setLocalTranslation] = useState<string | null>(null);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const localLoaderRef = useRef({ cancelled: false });

  useEffect(() => {
    localLoaderRef.current.cancelled = false;
    async function loadLocal() {
      // If settings indicate Arabic display or if we always want Arabic from local DB
      setLoadingLocal(true);
      try {
        const surahId = verse.surahId || (verse as any).surahNumber || verse.surah?.number;
        if (!surahId) return;

        // quick cache check for arabic
        const cached = cacheGet<string>(surahId, verse.verseNumber, 'local_ar');
        if (cached) { setLocalArabic(cached); }

        const row = await getVerseFromLocalDB(surahId, verse.verseNumber);
        if (localLoaderRef.current.cancelled) return;
        if (row) {
          if (row.ayah) { setLocalArabic(row.ayah); cacheSet(surahId, verse.verseNumber, 'local_ar', row.ayah); }
          if (row.transliteration) { setLocalTransliteration(row.transliteration); cacheSet(surahId, verse.verseNumber, 'local_tr', row.transliteration); }
          if (row.translation) { setLocalTranslation(row.translation); cacheSet(surahId, verse.verseNumber, 'local_en', row.translation); }
        }
      } catch (e) {
        // ignore - we keep existing remote-provided text
        console.warn('[VerseItem] local DB load failed', e);
      } finally {
        setLoadingLocal(false);
      }
    }
    loadLocal();
    return () => { localLoaderRef.current.cancelled = true; };
  }, [verse.surahId, verse.verseNumber]);

  const displayedArabic = localArabic || arabicText;
  const displayedTransliteration = localTransliteration || transliteration;

  // Ensure translation: prefer local English translation (if present) and do NOT call remote for English.
  // Only fetch remote translation when user selects a non-English translation language.
  const [displayedTranslation, setDisplayedTranslation] = useState<string | null>(localTranslation || translation || null);
  useEffect(() => {
    let cancelled = false;
    async function ensureTranslation() {
      const surahId = verse.surahId || (verse as any).surahNumber || verse.surah?.number;
      if (!surahId) return;

      // If selected language is English (starts with 'en') then prefer local translation and do not call remote.
      const langBase = (translationLanguage || '').split('.')[0].toLowerCase();
      if (langBase === 'en') {
        // Use localTranslation if available, otherwise keep existing prop translation (already set in state)
        const cachedLocal = cacheGet<string>(surahId, verse.verseNumber, 'local_en');
        if (cachedLocal) { setDisplayedTranslation(cachedLocal); return; }
        // If no cached local but row loaded earlier might have set it; otherwise keep prop translation.
        return;
      }

      // Non-English language selected: try cache, then remote fetch
      const cacheVal = cacheGet<string>(surahId, verse.verseNumber, translationLanguage);
      if (cacheVal) { setDisplayedTranslation(cacheVal); return; }
      try {
        const remote = await getTranslationRemote(surahId, verse.verseNumber, translationLanguage);
        if (!cancelled && remote) {
          setDisplayedTranslation(remote);
          cacheSet(surahId, verse.verseNumber, translationLanguage, remote);
        }
      } catch (e) {
        console.warn('[VerseItem] remote translation failed', e);
      }
    }
    ensureTranslation();
    return () => { cancelled = true; };
  }, [translationLanguage, verse.id, verse.verseNumber]);

  return (
    <Pressable
      style={[
        styles.container,
        containerStyle
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.verseNumber, { backgroundColor: primary }]}>
          <Text style={[styles.verseNumberText, { color: '#ffffff' }]}>
            {verse.verseNumber}
          </Text>
        </View>

        <View style={styles.verseInfo}>
          <Text style={[styles.verseInfoText, { color: '#ffffff' }]}>
            Juz {verse.juzNumber || 1} • Page {verse.pageNumber || 1}
          </Text>
          {/* Audio status moved to parent; VerseItem no longer displays audio error/fallback text here */}
        </View>

        {/* 1) Tafsir first */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open tafsir"
          style={[styles.controlButton, styles.subtleGoldBg, { marginLeft: 8 }]}
          onPress={() => setShowTafsirModal(true)}
        >
          <BookOpen size={18} color="#FFD700" />
        </TouchableOpacity>

        {/* 2) Bookmark */}
        <Pressable
          style={({ pressed }) => [
            styles.bookmarkButton,
            bookmarked && { backgroundColor: '#333333' },
            pressed && { opacity: 0.6 }
          ]}
          onPress={handleToggleBookmark}
        >
          <BookmarkIcon size={16} color={bookmarked ? '#FFD700' : '#888888'} fill={bookmarked ? '#FFD700' : 'transparent'} />
        </Pressable>

        {/* 3) Play */}
        <Pressable 
          style={[styles.audioButton, { backgroundColor: primary, marginRight: 8 }]} 
          onPress={() => {
            const surahNum = verse.surahId || (verse as any).surahNumber || (verse.surah && verse.surah.number) || 0;
            const verseNum = verse.verseNumber || 0;
            const globalId = undefined; // parent may compute if needed
            onPlayAudio?.(surahNum, verseNum, globalId, repeatCount, infiniteLoop);
          }}
        >
          <Play size={16} color="#ffffff" />
        </Pressable>
        
        {/* 4) Repeat options */}
        <TouchableOpacity 
          style={[styles.controlButton]} 
          onPress={() => setShowPlaybackModal(true)}
        >
          <Repeat size={18} color="#FFD700" />
          <Text style={{ color: '#FFD700', fontSize: 12, marginLeft: 2 }}>
            {infiniteLoop ? '∞' : `${repeatCount}x`}
          </Text>
        </TouchableOpacity>

      </View>


      {arabicFont === 'tajweed' && verse.tajweedText ? (
        <View style={styles.arabicContainer}>
          <TajweedVerse
            verse={displayedArabic}
            config={{
              style: {
                fontSize: arabicTypography.fontSize,
                lineHeight: arabicTypography.lineHeight,
                color: '#FFFFFF',
                direction: 'rtl',
                fontFamily: arabicFamily,
              }
            }}
          />
        </View>
      ) : (
        <Text style={arabicTextStyle}>
          {displayedArabic}
        </Text>
      )}

      {showTransliteration && displayedTransliteration && (
        <Text style={transliterationTextStyle}>
          {displayedTransliteration}
        </Text>
      )}

      {showTranslation && displayedTranslation && (
        <Text style={translationTextStyle}>
          {displayedTranslation}
        </Text>
      )}

      <View style={styles.datesRow}>
        <View style={[styles.dateCol, { opacity: (memorized || surahMemorizedGlobally) ? 1 : 0.5 }]}>
          {memorized && memorizedDate && (
            <Text style={[
              styles.memorizedDateText,
              // Enhanced styling when both are selected
              (memorized || surahMemorizedGlobally) && (revised || surahRevisedGlobally) && { 
                fontWeight: '600',
                textShadowColor: '#4CAF50',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 1,
              }
            ]}>
              Memorized: {memorizedDate}
            </Text>
          )}
          {surahMemorizedGlobally && !memorized && (
            <Text style={[
              styles.memorizedDateText,
              // Enhanced styling when both are selected
              surahMemorizedGlobally && (revised || surahRevisedGlobally) && { 
                fontWeight: '600',
                textShadowColor: '#4CAF50',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 1,
              }
            ]}>
              Memorized: (Surah level)
            </Text>
          )}
          {!memorized && !surahMemorizedGlobally && (
            <Text style={[styles.memorizedDateText, { opacity: 0.3 }]}>
              Not memorized
            </Text>
          )}
        </View>
        <View style={[styles.dateCol, { opacity: (revised || surahRevisedGlobally) ? 1 : 0.5 }]}>
          {revised && revisedDate && (
            <Text style={[
              styles.revisedDateText,
              // Enhanced styling when both are selected
              (memorized || surahMemorizedGlobally) && (revised || surahRevisedGlobally) && { 
                fontWeight: '600',
                textShadowColor: '#FF9800',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 1,
              }
            ]}>
              Revised: {revisedDate}
            </Text>
          )}
          {surahRevisedGlobally && !revised && (
            <Text style={[
              styles.revisedDateText,
              // Enhanced styling when both are selected
              (memorized || surahMemorizedGlobally) && surahRevisedGlobally && { 
                fontWeight: '600',
                textShadowColor: '#FF9800',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 1,
              }
            ]}>
              Revised: (Surah level)
            </Text>
          )}
          {!revised && !surahRevisedGlobally && (
            <Text style={[styles.revisedDateText, { opacity: 0.3 }]}>
              Not revised
            </Text>
          )}
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <Pressable style={memorizedButtonStyle} onPress={handleMarkMemorized} android_ripple={{ color: 'transparent' }}>
          {memorized ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <XIcon size={14} color={'#ffffff'} />
              <Text style={[memorizedTextStyle, { marginLeft: 6 }]}>Unmark</Text>
            </View>
          ) : (
            <Text style={memorizedTextStyle}>Mark Memorized</Text>
          )}
        </Pressable>

        <Pressable style={revisedButtonStyle} onPress={handleMarkRevised} android_ripple={{ color: 'transparent' }}>
          {revised ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <XIcon size={14} color={'#ffffff'} />
              <Text style={[revisedTextStyle, { marginLeft: 6 }]}>Unmark</Text>
            </View>
          ) : (
            <Text style={revisedTextStyle}>Mark Revised</Text>
          )}
        </Pressable>
      </View>

      <Modal
        visible={showPlaybackModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPlaybackModal(false)}
        supportedOrientations={['portrait']}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPlaybackModal(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Playback Settings</Text>
            
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Repeat</Text>
              <View style={styles.optionsContainer}>
                {[1, 2, 3, 5, 7, 10].map((count) => (
                  <TouchableOpacity
                    key={`repeat-${count}`}
                    style={[
                      styles.optionButton,
                      repeatCount === count && !infiniteLoop && styles.optionButtonSelected
                    ]}
                    onPress={() => {
                      setRepeatCount(count);
                      setRepeatMode(count);
                      setInfiniteLoop(false);
                    }}
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
                  onPress={() => {
                    setInfiniteLoop(true);
                    setRepeatCount(0);
                  }}
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
                {PLAYBACK_SPEED_OPTIONS.map((speed) => (
                  <TouchableOpacity
                    key={`speed-${speed}`}
                    style={[
                      styles.speedOption,
                      playbackSpeed === speed && styles.speedOptionSelected
                    ]}
                    onPress={() => handlePlaybackSpeedPress(speed)}
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
            >
              <Text style={styles.modalCloseButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Tafsir Modal */}
      <TafsirModal
        visible={showTafsirModal}
        onClose={() => setShowTafsirModal(false)}
        surahId={verse.surahId || verse.surahNumber || verse.surah?.number || 1}
        verseNumber={verse.verseNumber}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16, padding: 14, borderRadius: 12 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  verseNumber: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  verseNumberText: { fontSize: 12, fontWeight: 'bold' },
  verseInfo: { flex: 1, marginLeft: 8 },
  verseInfoText: { fontSize: 12, opacity: 0.8 },
  audioErrorText: { fontSize: 12, marginTop: 4 },
  audioFallbackText: { fontSize: 12, marginTop: 4 },
  audioButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
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
  },
  subtleGoldBg: {
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderColor: 'rgba(255, 215, 0, 0.25)',
  },
  arabicContainer: {
    paddingHorizontal: 4,
  },
  datesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 4, paddingHorizontal: 4 },
  dateCol: { width: '48%', alignItems: 'center' },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  memorizedDateText: { color: '#4CAF50', fontFamily: 'ScheherazadeNew-Regular', textAlign: 'center', marginBottom: 2, fontSize: 12 },
  revisedDateText: { color: '#FF9800', fontFamily: 'ScheherazadeNew-Regular', textAlign: 'center', marginBottom: 2, fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 350,
    maxHeight: '80%',
  },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
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
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: '500',
  },
  modalCloseButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

// Only re-render when the verse identity (and key identifiers) change.
// This avoids expensive re-renders caused by parent recreating function props each time.
const areEqual = (prev: VerseItemProps, next: VerseItemProps) => {
  if (prev.verse.id !== next.verse.id) return false;
  if (prev.verse.verseNumber !== next.verse.verseNumber) return false;
  const prevSurah = prev.verse.surahId ?? (prev.verse as any).surahNumber;
  const nextSurah = next.verse.surahId ?? (next.verse as any).surahNumber;
  if (prevSurah !== nextSurah) return false;
  // Check global state props
  if (prev.surahMemorizedGlobally !== next.surahMemorizedGlobally) return false;
  if (prev.surahRevisedGlobally !== next.surahRevisedGlobally) return false;
  // Ignore function prop identity changes (isMemorized, isRevised, on* handlers)
  return true;
};

export default memo(VerseItem, areEqual);
