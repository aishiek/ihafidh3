import { useProgressStore } from '@/store/progressStore';
import { PLAYBACK_SPEED_OPTIONS, useSettingsStore, type PlaybackSpeed } from '@/store/settingsStore';
import { Verse } from '@/types';
import { pauseAudio, playVerseWithOptionalBismillah, setPlaybackSpeed, type AudioStatus } from '@/utils/audioUtils';
import { getArabicFontFamily } from '@/utils/fontUtils';
import { useThemeColor } from '@/utils/useThemeColor';
import { Infinity as InfinityIcon, Pause, Play, Repeat, Bookmark as BookmarkIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useBookmarkStore } from '@/store/bookmarkStore';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TajweedVerse from 'rn-tajweed-verse';

interface VerseItemProps {
  verse: Verse;
  isMemorized: () => boolean;
  isRevised: () => boolean;
  onMemorizeToggle: () => void;
  onRevisionToggle: () => void;
  onPlayAudio: () => void;
}

const VerseItem = ({
  verse,
  isMemorized,
  isRevised,
  onMemorizeToggle,
  onRevisionToggle,
  onPlayAudio,
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioFallback, setAudioFallback] = useState(false);
  const [memorized, setMemorized] = useState(false);
  const [revised, setRevised] = useState(false);
  const [repeatCount, setRepeatCount] = useState(repeatMode || 1);
  const [showPlaybackModal, setShowPlaybackModal] = useState(false);
  const [memorizedDateLocal, setMemorizedDateLocal] = useState<string | null>(null);
  const [revisedDateLocal, setRevisedDateLocal] = useState<string | null>(null);
  const { addBookmark, removeBookmark, isBookmarked } = useBookmarkStore();
  const bookmarked = isBookmarked(verse.id);

  const memorizedVerseDates = useProgressStore(state => state.memorizedVerseDates);
  const revisedVerses = useProgressStore(state => state.revisedVerses);

  const toPrettyDate = useCallback((dateStr: string | null): string | null => {
    if (!dateStr) return null;
    if (/\b[A-Za-z]{3}\b/.test(dateStr)) return dateStr;
    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const [_, y, mo, d] = m;
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const monthIdx = Math.max(0, Math.min(11, parseInt(mo, 10) - 1));
      return `${parseInt(d,10)} ${months[monthIdx]} ${y}`;
    }
    const dt = new Date(dateStr);
    if (!isNaN(dt.getTime())) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
    }
    return dateStr;
  }, []);

  const persistedMemDate = useMemo(() => memorizedVerseDates?.[verse.id] || null, [memorizedVerseDates, verse.id]);
  const persistedRevDate = useMemo(() => {
    const rv = revisedVerses.find(v => v.verseId === verse.id);
    return rv?.revisionDate ?? null;
  }, [revisedVerses, verse.id]);

  useEffect(() => {
    setMemorized(isMemorized());
    setRevised(isRevised());
    setMemorizedDateLocal(toPrettyDate(persistedMemDate));
    setRevisedDateLocal(toPrettyDate(persistedRevDate));
  }, [verse, isMemorized, isRevised, persistedMemDate, persistedRevDate, toPrettyDate]);

  const onStatus = useCallback((status: AudioStatus) => {
    // isPlaying from the audio engine is the source of truth
    if (typeof status.isPlaying === 'boolean') {
      setIsPlaying(status.isPlaying);
    }

    // Handle errors
    if (status?.error) {
      setAudioError(status.error);
      setAudioFallback(false);
    } else {
      setAudioError(null);
    }

    // Handle fallback UI
    if (status?.fallbackUsed) {
      setAudioFallback(true);
    }
  }, [setIsPlaying, setAudioError, setAudioFallback]);

  const handlePlayAudio = useCallback(async () => {
    console.log(`VerseItem: Attempting to play verse ${verse.verseNumber} from surah ${verse.surahId || verse.surahNumber}`);
    try {
      if (isPlaying) {
        console.log('VerseItem: Pausing audio');
        await pauseAudio();
      } else {
        console.log('VerseItem: Starting audio playback');
        // Use 0 for infinite loop, otherwise use the selected repeat count
        const { infiniteLoop } = useSettingsStore.getState();
        const repeats = infiniteLoop ? 0 : repeatCount;
        console.log(`VerseItem: Playing with ${repeats} repeats`);
        await playVerseWithOptionalBismillah(verse, repeats, onStatus);
      }
    } catch (error) {
      console.error('VerseItem: Audio playback error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setAudioError(errorMessage);
      setIsPlaying(false);
    }
  }, [verse, repeatCount, onStatus, isPlaying]);

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

  useEffect(() => {
    return () => { pauseAudio().catch(console.error); };
  }, []);

  const formatDate = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const handleMarkMemorized = useCallback(() => {
  // Update UI immediately
  setMemorized(prev => {
    const next = !prev;
    setMemorizedDateLocal(next ? formatDate(new Date()) : null);
    return next;
  });

  // Trigger store update asynchronously to avoid blocking UI
  setTimeout(() => {
    onMemorizeToggle();
  }, 0);
}, [onMemorizeToggle]);

const handleMarkRevised = useCallback(() => {
  // Update UI immediately
  setRevised(prev => {
    const next = !prev;
    setRevisedDateLocal(next ? formatDate(new Date()) : null);
    return next;
  });

  // Trigger store update asynchronously
  setTimeout(() => {
    onRevisionToggle();
  }, 0);
}, [onRevisionToggle]);

  const handlePlaybackSpeedPress = useCallback(async (speed: PlaybackSpeed) => {
    setStorePlaybackSpeed(speed);
    await setPlaybackSpeed(speed);
  }, []);

  const toggleInfiniteLoop = useCallback(() => {
    const newInfiniteLoop = !infiniteLoop;
    setInfiniteLoop(newInfiniteLoop);
    
    // If enabling infinite loop and audio is playing, update the playback
    if (newInfiniteLoop && isPlaying) {
      // Restart with infinite loop
      handlePlayAudio();
    }
  }, [infiniteLoop, isPlaying, handlePlayAudio, setInfiniteLoop]);

  useEffect(() => {
    if (repeatMode && repeatMode !== repeatCount) {
      setRepeatCount(repeatMode);
    }
  }, [repeatMode]);

  const arabicFamily = getArabicFontFamily(arabicFont as any);
  const arabicText = verse.arabicText?.trim() || 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
  const translation = verse.translation?.trim() || 'In the name of Allah, the Entirely Merciful, the Especially Merciful.';
  const transliteration = verse.transliteration?.trim();

  return (
    <Pressable
      style={[
        styles.container,
        { 
          backgroundColor: memorized ? '#4CAF5020' : '#1a1a1a', 
          borderColor: memorized ? '#4CAF50' : '#ffffff',
          borderWidth: memorized ? 2 : 1
        }
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
          {audioError && <Text style={[styles.audioErrorText, { color: '#ff5252' }]}>{audioError}</Text>}
          {audioFallback && <Text style={[styles.audioFallbackText, { color: '#FFD700' }]}>Using fallback reciter (Alafasy)</Text>}
        </View>

        {/* Bookmark button (before audio button) */}
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

        <Pressable 
          style={[styles.audioButton, { 
            backgroundColor: primary,
            marginRight: 8
          }]} 
          onPress={handlePlayAudio}
        >
          {isPlaying ? <Pause size={16} color="#ffffff" /> : <Play size={16} color="#ffffff" />}
        </Pressable>
        
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
        <TajweedVerse
          verse={verse.tajweedText}
          config={{
            style: {
              fontSize: fontSizeArabic,
              lineHeight: fontSizeArabic * 1.8,
              color: '#FFFFFF',
              direction: 'rtl',
              fontFamily: arabicFamily,
            }
          }}
        />
      ) : (
        <Text
          style={{
            color: '#ffffff',
            fontSize: fontSizeArabic,
            fontFamily: arabicFamily,
            lineHeight: fontSizeArabic * 1.8,
            textAlign: 'right',
            paddingHorizontal: 4,
            letterSpacing: -0.2,
          }}
        >
          {arabicText}
        </Text>
      )}

      {showTransliteration && transliteration && (
        <Text style={{ color: '#FFD700', fontSize: fontSizeTransliteration, marginTop: 8 }}>
          {transliteration}
        </Text>
      )}

      {showTranslation && (
        <Text style={{ color: '#ffffff', fontSize: fontSizeTranslation, marginTop: 4 }}>
          {translation}
        </Text>
      )}

      <View style={styles.datesRow}>
        <View style={styles.dateCol}>
          {!!memorizedDateLocal && <Text style={styles.memorizedDateText}>{memorizedDateLocal}</Text>}
        </View>
        <View style={styles.dateCol}>
          {!!revisedDateLocal && <Text style={styles.revisedDateText}>{revisedDateLocal}</Text>}
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <Pressable
          style={{
            flex: 1,
            marginHorizontal: 4,
            paddingVertical: 9,
            borderRadius: 8,
            alignItems: 'center',
            backgroundColor: memorized ? '#4CAF50' : '#000000',
            borderColor: memorized ? '#4CAF50' : '#ffffff',
            borderWidth: 1,
          }}
          onPress={handleMarkMemorized}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: memorized ? '#000000' : '#ffffff' }}>
            {memorized ? 'Unmark ❌' : 'Memorized'}
          </Text>
        </Pressable>

        <Pressable
          style={{
            flex: 1,
            marginHorizontal: 4,
            paddingVertical: 9,
            borderRadius: 8,
            alignItems: 'center',
            backgroundColor: revised ? '#FF9800' : '#000000',
            borderColor: revised ? '#FF9800' : '#ffffff',
            borderWidth: 1,
          }}
          onPress={handleMarkRevised}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: revised ? '#000000' : '#ffffff' }}>
            {revised ? 'Unmark ❌' : 'Revised'}
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={showPlaybackModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPlaybackModal(false)}
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
  datesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 2, paddingHorizontal: 4 },
  dateCol: { width: '48%', alignItems: 'center' },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
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
  // Ignore function prop identity changes (isMemorized, isRevised, on* handlers)
  return true;
};

export default memo(VerseItem, areEqual);
