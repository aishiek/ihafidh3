import { VerseRef } from '@/app/audio/PageAudioManager';
import { PageAudioControls } from '@/app/pagemode/PageAudioControls';
import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MushafFooter({
  pageNumber,
  totalPages,
  onPrevious,
  onNext,
  onPrevSurah,
  onGoToSurah,
  onNextSurah,
  isDbReady,
  verses,
  reciterId,
}: {
  pageNumber: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  onPrevSurah?: () => void;
  onGoToSurah?: () => void;
  onNextSurah?: () => void;
  isDbReady?: boolean;
  verses?: VerseRef[];
  reciterId?: string;
}) {
  const animPrev = React.useRef(new Animated.Value(1)).current;
  const animNext = React.useRef(new Animated.Value(1)).current;

  const pressAnim = (anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 0.92, duration: 90, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      {verses && verses.length > 0 ? (
        <View style={styles.audioContainer}>
          <PageAudioControls
            verses={verses}
            reciterId={reciterId}
          />
        </View>
      ) : (
        <View style={styles.missingAudioContainer}>
          <Text style={styles.missingAudioText}>Page audio unavailable</Text>
          <Text style={styles.missingAudioHint}>Try switching layouts or restarting the app</Text>
        </View>
      )}
      <View style={styles.footer}>
        <View style={styles.leftGroup}>
          <Animated.View style={{ transform: [{ scale: animPrev }] }}>
            <Pressable onPress={() => { pressAnim(animPrev); onPrevious(); }} style={styles.iconBtn} accessibilityLabel="Prev">
              <Text style={styles.pageText}>Prev</Text>
            </Pressable>
          </Animated.View>
        </View>

        <View style={styles.centerGroup}>
          {/* Always allow users to open the Surah picker — SurahList will gracefully alert
              if the Mushaf DB is missing. Disabling the button here prevented pick
              behavior for some layouts (eg. qudratullah) and was too aggressive. */}
          <Pressable onPress={onGoToSurah} style={styles.surahBtn} accessibilityLabel="Surah Picker">
            <Text style={styles.surahText}>Surah</Text>
          </Pressable>
        </View>

        <View style={styles.rightGroup}>
          <Animated.View style={{ transform: [{ scale: animNext }] }}>
            <Pressable onPress={() => { pressAnim(animNext); onNext(); }} style={styles.iconBtn} accessibilityLabel="Next">
              <Text style={styles.pageText}>Next</Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#0b0b0b' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#0b0b0b' },
  leftGroup: { flexDirection: 'row', alignItems: 'center' },
  rightGroup: { flexDirection: 'row', alignItems: 'center' },
  centerGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  audioContainer: { borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 8 },
  missingAudioContainer: { padding: 12, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#333' },
  missingAudioText: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  missingAudioHint: { color: '#999', fontSize: 12 },
  pageText: { color: '#fff', fontWeight: '700', marginBottom: 4 },
  iconBtn: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  surahBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFD166', borderRadius: 8, marginTop: 4 },
  surahLabel: { color: '#cbd5e1', fontSize: 12, marginBottom: 4 },
  surahText: { color: '#1a1a2e', fontWeight: '700' },
  goBtn: { marginTop: 4, backgroundColor: '#0ea5a4', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  goText: { color: '#042f2e', fontWeight: '700' }
  , disabled: { opacity: 0.5 }
});
