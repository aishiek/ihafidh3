import { surahsData } from '@/data/surahs';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Dimensions, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getSurahStartPage } from '../services/mushafSurahService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_HEIGHT = 56;

// Define a simplified Surah interface that matches our data structure
interface SimpleSurah {
  id: number;
  name: string;
  arabicName: string;
  englishName: string;
  revelationType: string;
  versesCount: number;
}

// Helper function to get the revelation type with fallback
const getRevelationType = (surah: SimpleSurah): string => {
  return surah.revelationType || 'Meccan';
};

// Helper function to get the English name with fallback
const getEnglishName = (surah: SimpleSurah): string => {
  return surah.englishName || `Surah ${surah.id}`;
};

export default function SurahList({ onClose, onSelect, extraBottomPadding = 0 }: { onClose?: () => void; onSelect?: (page: number) => void; extraBottomPadding?: number }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSurahs = useMemo<SimpleSurah[]>(() => {
    if (!searchQuery) return surahsData as unknown as SimpleSurah[];
    const query = searchQuery.toLowerCase();
    return (surahsData as unknown as SimpleSurah[]).filter(
      surah =>
        surah.name.toLowerCase().includes(query) ||
        getEnglishName(surah).toLowerCase().includes(query) ||
        (surah.arabicName && surah.arabicName.toLowerCase().includes(query)) ||
        surah.id.toString() === searchQuery
    );
  }, [searchQuery]);

  const handleOpen = async (surahId: number) => {
    console.log(`[SurahList] selected surah=${surahId} - querying DB for start page`);
    try {
      const page = await getSurahStartPage(surahId);
      const pageNum = Number(page) || 1;
      console.log(`[SurahList] surah=${surahId} -> page=${pageNum}`);

      if (onSelect) {
        try {
          await onSelect(pageNum);
        } catch (e) {
          console.error('[SurahList] onSelect handler threw', e);
          Alert.alert('Error', 'Failed to open the selected surah. Please try again.');
        }
      } else {
        // fallback: use router navigation
        try {
          router.push(`/mushaf/viewer?pageNumber=${pageNum}`);
        } catch (e) {
          console.error('[SurahList] router push failed', e);
          Alert.alert('Navigation Error', 'Could not navigate to the selected surah.');
        }
      }
    } catch (e) {
      console.error('[SurahList] failed to get start page', e);
      Alert.alert('Database Error', 'Could not read Mushaf data. Ensure the Mushaf is downloaded and try again.');
    } finally {
      try { onClose?.(); } catch (_) { /* ignore */ }
    }
  };

  const renderItem = ({ item }: { item: SimpleSurah }) => (
    <Pressable 
      style={styles.row} 
      onPress={() => handleOpen(item.id)}
      android_ripple={{ color: 'rgba(255, 255, 255, 0.1)' }}
    >
      <View style={styles.numberContainer}>
        <Text style={styles.number}>{item.id}</Text>
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {item.name}
          {/* English name is already wrapped in Text below, so move it out for clarity */}
        </Text>
        <Text style={styles.englishName} numberOfLines={1}>• {getEnglishName(item)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.subtitle} numberOfLines={1}>
            {item.arabicName} • {item.versesCount || '?'} verses • 
          </Text>
          <Text
            style={[styles.subtitle, { flexShrink: 0, marginLeft: 2 }]} 
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {getRevelationType(item)}
          </Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {/* Add top padding for safe area */}
      <View style={[styles.searchContainer, { paddingTop: 12 }]}>
        <View style={styles.searchBoxRow}>
          {/* Search Icon (use emoji for simplicity, replace with Icon if available) */}
          <Text style={styles.searchIcon}>🔍</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.searchLabel}>Search Surah</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Type to search..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
          </View>
        </View>
      </View>
      <FlatList
        data={filteredSurahs}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        getItemLayout={(data, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        contentContainerStyle={[styles.listContent, { paddingBottom: 20 + extraBottomPadding }]}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  searchContainer: {
    padding: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  searchBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#23293a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 2,
  },
  searchIcon: {
    fontSize: 20,
    color: '#888',
    marginRight: 8,
  },
  searchLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 2,
  },
  searchInput: {
    backgroundColor: '#23293a',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 16,
    borderWidth: 0,
    marginBottom: 0,
  },
  listContent: {
    paddingBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    minHeight: ITEM_HEIGHT,
  },
  numberContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  number: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 14,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  englishName: {
    color: '#94a3b8',
    fontSize: 14,
    marginLeft: 6,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 12,
  },
});
