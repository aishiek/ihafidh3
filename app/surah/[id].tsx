import VerseItem from "@/components/VerseItem";
import { getSurahById, isSurahFullyCached } from "@/services/quranApi";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function SurahScreen() {
  const { id: surahId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [surah, setSurah] = useState<any>(null);
  const [verses, setVerses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCached, setIsCached] = useState(false);

  // 🔹 Load Surah
  const loadSurah = useCallback(async () => {
    try {
      const surahData = await getSurahById(surahId);
      setSurah(surahData);

      const fullyCached = await isSurahFullyCached(surahId);
      setIsCached(fullyCached);

      setVerses(surahData.verses || []);
    } catch (err) {
      console.error("❌ ERROR loading verses:", err);
    } finally {
      setLoading(false);
    }
  }, [surahId]);

  useEffect(() => {
    loadSurah();
  }, [loadSurah]);

  // 🔹 Action Handlers
  const handlePlaySurah = () => {
    console.log("▶️ Playing surah...");
    // integrate your audioUtils play logic here
  };

  const handleMarkMemorized = () => {
    console.log("✓ Marked surah as memorized");
  };

  const handleMarkRevised = () => {
    console.log("⟳ Marked surah as revised");
  };

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
        {/* Surah info only, download button removed */}
        <Text style={styles.title}>{surah.name}</Text>
        <Text style={styles.subtitle}>
          {surah.englishName} • {surah.versesCount} Ayahs
        </Text>
      </View>

      {/* 🔹 Actions (Unified Buttons) */}
      <View style={styles.actions}>
        <TouchableOpacity
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
          onPress={handlePlaySurah}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>
            ▶️ Play Surah
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            flex: 1,
            marginHorizontal: 4,
            paddingVertical: 9,
            borderRadius: 8,
            alignItems: 'center',
            backgroundColor: '#4CAF50',
            borderColor: '#4CAF50',
            borderWidth: 1,
          }}
          onPress={handleMarkMemorized}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>
            ✓ Mark Memorized
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            flex: 1,
            marginHorizontal: 4,
            paddingVertical: 9,
            borderRadius: 8,
            alignItems: 'center',
            backgroundColor: '#FF9800',
            borderColor: '#FF9800',
            borderWidth: 1,
          }}
          onPress={handleMarkRevised}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>
            ⟳ Mark Revised
          </Text>
        </TouchableOpacity>
      </View>

      {/* 🔹 Verse List */}
      <FlatList
        data={verses}
        keyExtractor={(item) => item.id?.toString?.() ?? String(item.verseNumber ?? Math.random())}
        renderItem={({ item }) => (
          <VerseItem
            verse={item}
            isMemorized={() => false} // TODO: connect to memorization logic
            isRevised={() => false} // TODO: connect to revision logic
            onMemorizeToggle={() => {}} // TODO: connect to memorization logic
            onRevisionToggle={() => {}} // TODO: connect to revision logic
            onPlayAudio={() => {}} // TODO: connect to audio logic
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
