import VerseItem from "@/components/VerseItem";
import { surahsData } from "@/data/surahs";
import { getSurahById, isSurahFullyCached } from "@/services/quranApi";
import { useProgressStore } from "@/store/progressStore";
import { useSettingsStore } from '@/store/settingsStore';
import { getAudioUrl, playAudio } from '@/utils/audioUtils';
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

export default function SurahScreen() {
  const { id: surahId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [surah, setSurah] = useState<any>(null);
  const BATCH_SIZE = 20; // Local DB is fast; use larger batches
  const [verses, setVerses] = useState<any[]>([]); // currently loaded batches
  const [totalVerses, setTotalVerses] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [allVersesLoaded, setAllVersesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isCached, setIsCached] = useState(false);
  const fullSurahRef = useRef<any | null>(null);

  // Progress store integration
  const { 
    memorizedVerses, 
    revisedVerses, 
    markVerseAsMemorized,
    unmarkVerseAsMemorized,
    markVerseAsRevised,
    unmarkVerseAsRevised,
    bulkMarkVersesMemorized,
    bulkMarkVersesRevised
  } = useProgressStore();

  // Audio URL cache to avoid regenerating/checking availability repeatedly
  const audioUrlCacheRef = useRef<Record<string, string>>({});
  const { reciterIdentifier } = useSettingsStore();

  const handlePlayAudio = useCallback(async (surahNum: number, verseNum: number, _globalId?: number, repeats?: number, isInfinite?: boolean) => {
    try {
      const key = `${surahNum}:${verseNum}:${reciterIdentifier}`;
      let url = audioUrlCacheRef.current[key];
      if (!url) {
        // Synchronous URL construction (no network checks)
        url = getAudioUrl(reciterIdentifier, surahNum, verseNum);
        audioUrlCacheRef.current[key] = url;
      }
      // Play audio: use repeats passed from VerseItem or default to 1
      const repeatCountToUse = typeof repeats === 'number' ? repeats : 1;
      const infinite = !!isInfinite;
      await playAudio(url, repeatCountToUse, (status) => {
        // optional: update UI or store based on status
      });
    } catch (e) {
      console.error('Failed to play audio:', e);
      Alert.alert('Audio Error', 'Failed to play audio.');
    }
  }, [reciterIdentifier]);

  // 🔹 Load Surah
  const loadSurah = useCallback(async () => {
    try {
      const surahIdNum = parseInt(surahId, 10);
      const surahData = await getSurahById(surahIdNum);
      setSurah(surahData);

      const fullyCached = await isSurahFullyCached(surahIdNum);
      setIsCached(fullyCached);

      if (surahData) {
        // store full surah verses in a ref for incremental loading
        fullSurahRef.current = surahData;
        const total = surahData.versesCount || (surahData.verses || []).length || 0;
        setTotalVerses(total);

        // load only the first batch
        const firstBatch = (surahData.verses || []).slice(0, BATCH_SIZE);
        setVerses(firstBatch);
        setCurrentBatch(firstBatch.length > 0 ? 1 : 0);
        setAllVersesLoaded((firstBatch.length || 0) >= total);
      }
    } catch (err) {
      console.error("❌ ERROR loading verses:", err);
    } finally {
      setLoading(false);
    }
  }, [surahId]);

  useEffect(() => {
    loadSurah();
  }, [loadSurah]);

  // Surah-level state checking
  const isSurahMemorizedGlobally = useMemo(() => {
    if (!surah) return false;
    // compute full id range for surah using totalVerses
    const total = totalVerses || surah.versesCount || 0;
    let start = 0; for (let i = 1; i < surah.id; i++) { const s = surahsData.find(ss => ss.id === i)!; start += s.versesCount; }
    const allIds = Array.from({length: total}, (_, i) => start + 1 + i);
    return allIds.length > 0 && allIds.every((id: number) => memorizedVerses.includes(id));
  }, [surah, memorizedVerses, totalVerses]);

  const isSurahRevisedGlobally = useMemo(() => {
    if (!surah) return false;
    const total = totalVerses || surah.versesCount || 0;
    let start = 0; for (let i = 1; i < surah.id; i++) { const s = surahsData.find(ss => ss.id === i)!; start += s.versesCount; }
    const allIds = Array.from({length: total}, (_, i) => start + 1 + i);
    return allIds.length > 0 && allIds.every((id: number) => revisedVerses.some(rv => rv.verseId === id));
  }, [surah, revisedVerses, totalVerses]);

  // Individual verse handlers
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

  // 🔹 Action Handlers
  const handlePlaySurah = () => {
    console.log("▶️ Playing surah...");
    // integrate your audioUtils play logic here
  };

  const handleMarkMemorized = useCallback(async () => {
    if (!surah) return;
    let start = 0; for (let i = 1; i < surah.id; i++) { const s = surahsData.find(ss => ss.id === i)!; start += s.versesCount; }
    const surahVerseIds = Array.from({length: surah.versesCount}, (_, i) => start + 1 + i);
    const isCurrentlyMemorized = isSurahMemorizedGlobally;
    try {
      if (isCurrentlyMemorized) {
        await bulkMarkVersesMemorized(surahVerseIds, false);
        // Guard: ensure all individual marks are cleared
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
  }, [surah, isSurahMemorizedGlobally, bulkMarkVersesMemorized, memorizedVerses, unmarkVerseAsMemorized]);

  const handleMarkRevised = useCallback(async () => {
    if (!surah) return;
    let start = 0; for (let i = 1; i < surah.id; i++) { const s = surahsData.find(ss => ss.id === i)!; start += s.versesCount; }
    const surahVerseIds = Array.from({length: surah.versesCount}, (_, i) => start + 1 + i);
    const isCurrentlyRevised = isSurahRevisedGlobally;
    try {
      if (isCurrentlyRevised) {
        surahVerseIds.forEach(verseId => {
          unmarkVerseAsRevised(verseId);
        });
      } else {
        await bulkMarkVersesRevised(surahVerseIds);
      }
    } catch (error) {
      console.error('Failed to toggle surah revision:', error);
      Alert.alert('Error', 'Failed to update revision status. Please try again.');
    }
  }, [surah, isSurahRevisedGlobally, bulkMarkVersesRevised, unmarkVerseAsRevised]);

  // Load next batch when user scrolls near the end
  const loadNextBatch = useCallback(async () => {
    if (isLoadingMore || allVersesLoaded) return;
    if (!fullSurahRef.current) return;

    setIsLoadingMore(true);
    try {
      const surahData = fullSurahRef.current;
      const alreadyLoaded = verses.length;
      const nextStart = alreadyLoaded;
      const nextEnd = Math.min(alreadyLoaded + BATCH_SIZE, surahData.verses.length);
      if (nextStart >= nextEnd) {
        setAllVersesLoaded(true);
        setIsLoadingMore(false);
        return;
      }

      // simulate small delay for perceived responsiveness (optional)
      // await new Promise(r => setTimeout(r, 100));

      const nextBatch = surahData.verses.slice(nextStart, nextEnd);
      setVerses(prev => [...prev, ...nextBatch]);
      setCurrentBatch(prev => prev + 1);
      if (nextEnd >= (surahData.versesCount || surahData.verses.length)) {
        setAllVersesLoaded(true);
      }
    } catch (e) {
      console.error('Error loading next batch:', e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, allVersesLoaded, verses.length]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!surah) {
    return (
      <View style={styles.center}>
        <Text>⚠️ Failed to load Surah</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 🔹 Surah Title */}
      <View style={styles.header}>
        {/* Centered Arabic and English names with surah number */}
        <Text style={styles.title}>{surah.arabicName}</Text>
        <Text style={styles.subtitle}>
          {surah.id}. {surah.englishName} • {surah.versesCount} Ayahs
        </Text>
      </View>

      {/* 🔹 Actions (Unified Buttons) */}
      <View style={styles.actions}>
        <Pressable
          style={{
            flex: 1,
            marginHorizontal: 4,
            paddingVertical: 9,
            borderRadius: 8,
            alignItems: 'center',
            backgroundColor: '#1976D2',
            borderColor: '#1976D2',
            borderWidth: 1,
          }}
          android_ripple={{ color: 'transparent' }}
          onPress={handlePlaySurah}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>
            ▶️ Play Surah
          </Text>
        </Pressable>
        <Pressable
          style={{
            flex: 1,
            marginHorizontal: 4,
            paddingVertical: 9,
            borderRadius: 8,
            alignItems: 'center',
            backgroundColor: isSurahMemorizedGlobally ? '#4CAF50' : '#333333',
            borderColor: isSurahMemorizedGlobally ? '#4CAF50' : '#666666',
            borderWidth: 1,
          }}
          android_ripple={{ color: 'transparent' }}
          onPress={handleMarkMemorized}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>
            {isSurahMemorizedGlobally ? '✓ Unmark Memorized' : '✓ Mark Memorized'}
          </Text>
        </Pressable>
        <Pressable
          style={{
            flex: 1,
            marginHorizontal: 4,
            paddingVertical: 9,
            borderRadius: 8,
            alignItems: 'center',
            backgroundColor: isSurahRevisedGlobally ? '#FF9800' : '#333333',
            borderColor: isSurahRevisedGlobally ? '#FF9800' : '#666666',
            borderWidth: 1,
          }}
          android_ripple={{ color: 'transparent' }}
          onPress={handleMarkRevised}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>
            {isSurahRevisedGlobally ? '⟳ Unmark Revision' : '⟳ Mark Revision'}
          </Text>
        </Pressable>
      </View>

      {/* 🔹 Verse List */}
      <FlatList
        data={verses}
        keyExtractor={(item) => item.id?.toString?.() ?? String(item.verseNumber ?? Math.random())}
        renderItem={({ item }) => (
          <VerseItem
            verse={item}
            onPlayAudio={(surahNum, verseNum, globalId, repeats, isInfinite) => handlePlayAudio(surahNum, verseNum, globalId, repeats, isInfinite)}
            surahMemorizedGlobally={isSurahMemorizedGlobally}
            surahRevisedGlobally={isSurahRevisedGlobally}
            onSurahMemorizeToggle={handleMarkMemorized}
            onSurahRevisionToggle={handleMarkRevised}
          />
        )}
        contentContainerStyle={styles.verseList}
        onEndReached={loadNextBatch}
        onEndReachedThreshold={0.5}
        ListFooterComponent={isLoadingMore ? <ActivityIndicator style={{ margin: 12 }} /> : null}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
        windowSize={5}
      />

      {/* 🔹 Continue Reading Example */}
      {/* Footer/tab bar handled by global layout, remove ThemedButton */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#1a1a1a', 
    padding: 16 
  },
  center: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#1a1a1a' 
  },
  header: { 
    marginBottom: 16,
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#fff', 
    marginBottom: 4,
    textAlign: 'center'
  },
  subtitle: { 
    fontSize: 14, 
    color: '#FFD700', 
    marginBottom: 8,
    textAlign: 'center'
  },
  actions: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 16 
  },
  verseList: { 
    paddingBottom: 32 
  },
});
