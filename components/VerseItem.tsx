import { useProgressStore } from '@/store/progressStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Verse } from '@/types';
import { pauseAudio, playVerseWithOptionalBismillah, type AudioStatus } from '@/utils/audioUtils';
import { getArabicFontFamily } from '@/utils/fontUtils';
import { useThemeColor } from '@/utils/useThemeColor';
import { Pause, Play, Repeat } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  const { fontSizeArabic, fontSizeTransliteration, fontSizeTranslation, arabicFont, showTranslation, showTransliteration, repeatMode, setRepeatMode } = useSettingsStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioFallback, setAudioFallback] = useState(false);
  const [memorized, setMemorized] = useState(false);
  const [revised, setRevised] = useState(false);
  const [repeatCount, setRepeatCount] = useState(repeatMode || 1);
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  const [memorizedDateLocal, setMemorizedDateLocal] = useState<string | null>(null);
  const [revisedDateLocal, setRevisedDateLocal] = useState<string | null>(null);

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

  const handlePlayAudio = useCallback(async () => {
    try {
      if (isPlaying) {
        await pauseAudio();
      } else {
        // Pass repeatCount from user selection
        await playVerseWithOptionalBismillah(verse, repeatCount, onStatus);
      }
    } catch (error) {
      console.error('Audio playback error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setAudioError(errorMessage);
      setIsPlaying(false);
    }
  }, [verse, repeatCount, isPlaying, onStatus]);

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



  useEffect(() => {
    if (repeatMode && repeatMode !== repeatCount) {
      setRepeatCount(repeatMode);
    }
  }, [repeatMode]);

  const arabicFamily = getArabicFontFamily(arabicFont);
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
            Juz {verse.juzNumber || 1} • Hizb {verse.hizbNumber || 1} • Page {verse.pageNumber || 1}
          </Text>
          {audioError && <Text style={[styles.audioErrorText, { color: '#ff5252' }]}>{audioError}</Text>}
          {audioFallback && <Text style={[styles.audioFallbackText, { color: '#FFD700' }]}>Using fallback reciter (Alafasy)</Text>}
        </View>

        <Pressable style={[styles.audioButton, { backgroundColor: primary }]} onPress={handlePlayAudio}>
          {isPlaying ? <Pause size={16} color="#ffffff" /> : <Play size={16} color="#ffffff" />}
        </Pressable>

        <TouchableOpacity style={[styles.repeatButton, { marginLeft: 8 }]} onPress={() => setShowRepeatModal(true)}>
          <Repeat size={18} color="#FFD700" />
          <Text style={{ color: '#FFD700', fontSize: 12, marginLeft: 2 }}>{repeatCount}x</Text>
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

      <Modal visible={showRepeatModal} transparent animationType="fade" onRequestClose={() => setShowRepeatModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPressOut={() => setShowRepeatModal(false)}>
          <View style={styles.repeatModalContent}>
            <Text style={styles.repeatModalTitle}>Change Repeat Mode</Text>
            <View style={styles.repeatOptionsRow}>
              {[1,2,3,4,5,7].filter(option => option !== repeatCount).map(option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.repeatOptionButton,
                    repeatCount === option && styles.repeatOptionButtonSelected
                  ]}
                  onPress={() => {
                    setRepeatMode(option);
                    setRepeatCount(option);
                    setShowRepeatModal(false);
                  }}
                >
                  <Text style={styles.repeatOptionText}>{option}x</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
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
  audioButton: { padding: 8, borderRadius: 8 },
  repeatButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#444' },
  datesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 2, paddingHorizontal: 4 },
  dateCol: { width: '48%', alignItems: 'center' },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  memorizedDateText: { color: '#4CAF50', fontFamily: 'ScheherazadeNew-Regular', textAlign: 'center', marginBottom: 2, fontSize: 12 },
  revisedDateText: { color: '#FF9800', fontFamily: 'ScheherazadeNew-Regular', textAlign: 'center', marginBottom: 2, fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  repeatModalContent: { backgroundColor: '#111', padding: 16, borderRadius: 12, width: '80%' },
  repeatModalTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  repeatOptionsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  repeatOptionButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#444', margin: 6 },
  repeatOptionButtonSelected: { backgroundColor: '#FFD70020', borderColor: '#FFD700' },
  repeatOptionText: { color: '#fff', fontSize: 14 },
});

export default memo(VerseItem);
