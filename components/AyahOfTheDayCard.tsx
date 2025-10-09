import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, AppState, AppStateStatus, Share as NativeShare, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { fetchSingleVerse } from '@/services/quranApi';
import { surahsData } from '@/data/surahs';
import { useSettingsStore } from '@/store/settingsStore';
import { Share2 } from 'lucide-react-native';

// Total number of verses in Quran
const TOTAL_VERSES = 6236; // keep in sync with other constants

// Precompute cumulative verse counts for fast global verseId -> (surah, verseNumber)
const cumulativeVerseOffsets: number[] = []; // start index (1-based) of each surah
(() => {
  let running = 1;
  for (let i = 1; i <= 114; i++) {
    cumulativeVerseOffsets[i] = running; // store starting global verse id
    const s = surahsData.find(x => x.id === i);
    running += (s?.versesCount || 0);
  }
})();

function globalVerseIdToSurah(verseId: number) {
  // binary search could be used; linear scan over 114 is fine (micro cost)
  for (let i = 1; i <= 114; i++) {
    const start = cumulativeVerseOffsets[i];
    const surah = surahsData.find(s => s.id === i);
    if (!surah || start === undefined) continue;
    const end = start + surah.versesCount - 1;
    if (verseId >= start && verseId <= end) {
      return { surahId: i, verseNumber: verseId - start + 1, surah };
    }
  }
  return null;
}

// Deterministic daily seed -> verseId (base selection before readability adjustments)
function getTodayGlobalVerseId(date = new Date()) {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = (date.getTime() - startOfYear.getTime()) + ((startOfYear.getTimezoneOffset() - date.getTimezoneOffset()) * 60000);
  const dayOfYear = Math.floor(diff / 86400000); // 1..366
  return ((dayOfYear - 1) % TOTAL_VERSES) + 1; // ensure 1-based
}

// Background pattern helper (returns gradient + an accent shape spec) deterministic per day
function patternForDay(dayIndex: number) {
  const palettes = [
    ['#1e3a8a', '#312e81', '#1e1b4b'],
    ['#064e3b', '#065f46', '#022c22'],
    ['#78350f', '#92400e', '#451a03'],
    ['#3f0f63', '#581c87', '#2e1065'],
    ['#0f766e', '#0d9488', '#042f2e'],
    ['#155e75', '#0e7490', '#082f49'],
    ['#4d0f52', '#831843', '#500724'],
  ];
  const idx = dayIndex % palettes.length;
  const colors = palettes[idx];
  return { colors, accentOpacity: 0.12 + (idx * 0.02) };
}

interface AyahOfTheDayCardProps { style?: any; }

export const AyahOfTheDayCard: React.FC<AyahOfTheDayCardProps> = ({ style }) => {
  const translationLang = useSettingsStore(state => state.translationLanguage) || 'en.asad';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ayah, setAyah] = useState<{ surahId: number; verseNumber: number; surahName: string; arabicName: string; translation: string } | null>(null);
  const dayKeyRef = useRef<string>('');
  const mountedRef = useRef(true);

  // Length heuristic for enabling scroll (no verse substitution)
  const MAX_SCROLL_TRIGGER_CHARS = 420; // if translation longer than this, enable scroll view

  const computeKey = (d = new Date()) => d.toISOString().split('T')[0];

  const loadAyah = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const today = new Date();
      const key = computeKey(today);
      dayKeyRef.current = key;
      const globalId = getTodayGlobalVerseId(today);
      const mapping = globalVerseIdToSurah(globalId);
      if (!mapping) throw new Error('Mapping failed');
      const verse = await fetchSingleVerse(mapping.surahId, mapping.verseNumber, translationLang);
      if (!verse) throw new Error('Fetch failed');
      if (!mountedRef.current) return;
      setAyah({
        surahId: mapping.surahId,
        verseNumber: mapping.verseNumber,
        surahName: mapping.surah?.name || `Surah ${mapping.surahId}`,
        arabicName: mapping.surah?.arabicName || '',
        translation: verse.translation || 'No translation',
      });
    } catch (e: any) {
      setError(e?.message || 'Unable to load today\'s ayah');
      setAyah(null);
    } finally {
      setLoading(false);
    }
  }, [translationLang]);

  // Initial load
  useEffect(() => { loadAyah(); }, [loadAyah]);

  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  // Refresh if app returns to foreground on a new day
  useEffect(() => {
    const listener = (s: AppStateStatus) => {
      if (s === 'active') {
        const keyNow = computeKey();
        if (dayKeyRef.current && keyNow !== dayKeyRef.current) {
          loadAyah();
        }
      }
    };
    const sub = AppState.addEventListener('change', listener);
    return () => { try { sub.remove(); } catch {} };
  }, [loadAyah]);

  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const diff = (today.getTime() - startOfYear.getTime()) + ((startOfYear.getTimezoneOffset() - today.getTimezoneOffset()) * 60000);
  const dayOfYear = Math.floor(diff / 86400000);
  const pattern = useMemo(() => patternForDay(dayOfYear), [dayOfYear]);

  const handlePress = () => {
    if (!ayah) return;
    router.push(`/(tabs)/read?surahId=${ayah.surahId}&verseId=${ayah.verseNumber}`);
  };

  const handleShare = async () => {
    if (!ayah) return;
    try {
      const message = `${ayah.translation}\n\n(${ayah.surahName} ${ayah.arabicName} • Ayah ${ayah.verseNumber}) – via iHafidh`;
      await NativeShare.share({ message });
    } catch (e) {
      // Silently ignore share cancellation
    }
  };

  return (
    <Pressable onPress={handlePress} disabled={!ayah} style={[styles.wrapper, style]} android_ripple={{ color: '#ffffff11' }}>
      <LinearGradient colors={pattern.colors as [string,string,string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
        {/* Accent overlay */}
        <View style={[styles.accentCircle, { opacity: pattern.accentOpacity }]} />
        {/* Share button */}
        <Pressable style={styles.shareButton} onPress={handleShare} hitSlop={8} android_ripple={{ color: '#ffffff22', borderless: true }}>
          <Share2 size={16} color="#fff" />
        </Pressable>
        <Text style={styles.headerText}>Ayah of the Day</Text>
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
        {!loading && error && (
          <Text style={styles.errorText} numberOfLines={3}>{error}</Text>
        )}
        {!loading && ayah && (
          <>
            {/** If text still long (exceeds inline lines heuristic) allow scroll */}
            {ayah.translation.length > MAX_SCROLL_TRIGGER_CHARS ? (
              <View style={styles.scrollWrapper}>
                <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
                  <Text style={styles.translationTextLong}>{ayah.translation.replace(/<[^>]+>/g,'')}</Text>
                </ScrollView>
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(0,0,0,0)','rgba(0,0,0,0.35)']}
                  style={styles.bottomFade}
                />
              </View>
            ) : (
              <Text
                style={styles.translationText}
                // Show full verse (no truncation). Keep adaptive font sizing if extremely long but below scroll threshold.
                adjustsFontSizeToFit={false}
              >
                {ayah.translation.replace(/<[^>]+>/g,'')}
              </Text>
            )}
            <Text style={styles.refText}>{ayah.surahName} ({ayah.arabicName}) • {ayah.verseNumber}</Text>
            <Text style={styles.hintText}>Tap to open</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrapper: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  gradient: { padding: 16, minHeight: 170, justifyContent: 'flex-start' },
  headerText: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 10, letterSpacing: 0.6 },
  translationText: { color: '#f1f5f9', fontSize: 18, lineHeight: 26, fontWeight: '500' },
  translationTextLong: { color: '#f1f5f9', fontSize: 18, lineHeight: 26, fontWeight: '500', paddingRight: 4, paddingBottom: 8 },
  refText: { color: '#e2e8f0', fontSize: 13, marginTop: 14, fontWeight: '600' },
  hintText: { color: '#cbd5e1', fontSize: 11, marginTop: 6, opacity: 0.7 },
  // removed adjustedTag style (no verse substitution now)
  errorText: { color: '#fecaca', fontSize: 13, fontWeight: '500' },
  center: { flex:1, justifyContent:'center', alignItems:'center', paddingVertical: 24 },
  accentCircle: { position:'absolute', width:220, height:220, borderRadius:110, backgroundColor:'#ffffff', top:-40, right:-40 },
  shareButton: { position:'absolute', top:10, right:10, width:32, height:32, borderRadius:16, backgroundColor:'rgba(255,255,255,0.18)', justifyContent:'center', alignItems:'center' },
  scrollWrapper: { maxHeight: 120, position: 'relative' },
  scrollArea: { paddingRight: 4 },
  bottomFade: { position: 'absolute', left:0, right:0, bottom:0, height: 28, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
});

export default AyahOfTheDayCard;
