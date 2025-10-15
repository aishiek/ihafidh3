import VerseItem from "@/components/VerseItem";
import { surahsData } from "@/data/surahs";
import { getSurahById, isSurahFullyCached } from "@/services/quranApi";
import { useProgressStore } from "@/store/progressStore";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

export default function SurahScreen() {
  const { id: surahId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [surah, setSurah] = useState<any>(null);
  const [verses, setVerses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCached, setIsCached] = useState(false);

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

  // 🔹 Load Surah
  const loadSurah = useCallback(async () => {
    try {
      const surahIdNum = parseInt(surahId, 10);
      const surahData = await getSurahById(surahIdNum);
      setSurah(surahData);

      const fullyCached = await isSurahFullyCached(surahIdNum);
      setIsCached(fullyCached);

      if (surahData) {
        setVerses(surahData.verses || []);
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
    // compute full id range for surah
    let start = 0; for (let i = 1; i < surah.id; i++) { const s = surahsData.find(ss => ss.id === i)!; start += s.versesCount; }
    const allIds = Array.from({length: surah.versesCount}, (_, i) => start + 1 + i);
    return allIds.length > 0 && allIds.every((id: number) => memorizedVerses.includes(id));
  }, [surah, memorizedVerses]);

  const isSurahRevisedGlobally = useMemo(() => {
    if (!surah) return false;
    let start = 0; for (let i = 1; i < surah.id; i++) { const s = surahsData.find(ss => ss.id === i)!; start += s.versesCount; }
    const allIds = Array.from({length: surah.versesCount}, (_, i) => start + 1 + i);
    return allIds.length > 0 && allIds.every((id: number) => revisedVerses.some(rv => rv.verseId === id));
  }, [surah, revisedVerses]);

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
            onPlayAudio={() => {}} // TODO: connect to audio logic
            surahMemorizedGlobally={isSurahMemorizedGlobally}
            surahRevisedGlobally={isSurahRevisedGlobally}
            onSurahMemorizeToggle={handleMarkMemorized}
            onSurahRevisionToggle={handleMarkRevised}
          />
        )}
        contentContainerStyle={styles.verseList}
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
