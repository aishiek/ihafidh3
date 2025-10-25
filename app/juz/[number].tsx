import VerseItem from '@/components/VerseItem';
import { getVersesByJuz } from '@/data/verses';
import { useProgressStore } from '@/store/progressStore';
import { Verse } from '@/types';
import { useCustomColors } from '@/utils/themeUtils';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function JuzScreen() {
  const { number } = useLocalSearchParams<{ number: string }>();
  const router = useRouter();
  const juzNumber = parseInt(number || '1');

  // Validate juzNumber to prevent crashes
  const validJuzNumber = useMemo(() => {
    const num = isNaN(juzNumber) ? 1 : juzNumber;
    return Math.max(1, Math.min(30, num)); // Ensure it's between 1-30
  }, [juzNumber]);
  
  const colors = useCustomColors();
  // No store method for Juz yet; use data layer
  const { memorizedVerses, revisedVerses } = useProgressStore();
  
  const [verses, setVerses] = useState<Verse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreVerses, setHasMoreVerses] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const pageSize = 20;
  
  const loadVerses = useCallback(async (page: number, isInitialLoad: boolean = false) => {
    // Prevent multiple simultaneous loads
    if ((isLoading && !isInitialLoad) || isLoadingMore) return;
    if (!hasMoreVerses && page > 1) return;
    
    try {
      if (page === 1) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }
      
      let newVerses: Verse[] = [];
      
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        );
        
  const fetchPromise = getVersesByJuz(validJuzNumber, page, pageSize);
        newVerses = await Promise.race([fetchPromise, timeoutPromise]);
      } catch (err) {
        console.error('Error fetching verses for Juz:', err);
        throw err;
      }
      
      // Validate the loaded verses
      const validVerses = newVerses.filter(verse => 
  verse && 
  typeof verse.id !== 'undefined' && 
  verse.juzNumber === validJuzNumber
      );
      
      if (validVerses.length === 0 || validVerses.length < pageSize) {
        setHasMoreVerses(false);
      }
      
      if (page === 1) {
        setVerses(validVerses);
      } else {
        setVerses(prev => {
          // Prevent duplicate verses
          const existingIds = new Set(prev.map(v => v.id));
          const uniqueNewVerses = validVerses.filter(v => !existingIds.has(v.id));
          return [...prev, ...uniqueNewVerses];
        });
      }
      
      setCurrentPage(page);
    } catch (err) {
      console.error('Failed to load verses:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load verses. Please try again.';
      setError(errorMessage);
      
      if (page === 1) {
        setVerses([]);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [validJuzNumber, hasMoreVerses, isLoading, isLoadingMore]);
  
  useEffect(() => {
    // Reset state when juz number changes
    setVerses([]);
    setCurrentPage(1);
    setHasMoreVerses(true);
    setError(null);
    setIsLoadingMore(false);
    
    loadVerses(1, true);
  }, [validJuzNumber]);
  
  const isVerseMemorized = useCallback((verseId: number) => {
    return Array.isArray(memorizedVerses) && memorizedVerses.includes(verseId);
  }, [memorizedVerses]);
  
  const isVerseRevised = useCallback((verseId: number) => {
    return Array.isArray(revisedVerses) && revisedVerses.some(v => v.verseId === verseId);
  }, [revisedVerses]);
  
  const handleLoadMore = useCallback(() => {
    if (!isLoading && !isLoadingMore && hasMoreVerses) {
      const nextPage = currentPage + 1;
      loadVerses(nextPage);
    }
  }, [isLoading, isLoadingMore, hasMoreVerses, currentPage, loadVerses]);
  
  const handleRetry = useCallback(() => {
    setCurrentPage(1);
    setHasMoreVerses(true);
    setError(null);
    setIsLoadingMore(false);
    loadVerses(1, true);
  }, [loadVerses]);
  
  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.footerText, { color: colors.text }]}>
          Loading more verses...
        </Text>
      </View>
    );
  }, [isLoadingMore, colors]);
  
  const getJuzDescription = useCallback((juzNumber: number): string => {
    const juzDescriptions: Record<number, string> = {
      1: "Al-Fatihah to Al-Baqarah 2:141",
      2: "Al-Baqarah 2:142 to 2:252",
      3: "Al-Baqarah 2:253 to Al-Imran 3:92",
      4: "Al-Imran 3:93 to An-Nisa 4:23",
      5: "An-Nisa 4:24 to 4:147",
      6: "An-Nisa 4:148 to Al-Ma'idah 5:81",
      7: "Al-Ma'idah 5:82 to Al-An'am 6:110",
      8: "Al-An'am 6:111 to Al-A'raf 7:87",
      9: "Al-A'raf 7:88 to Al-Anfal 8:40",
      10: "Al-Anfal 8:41 to At-Tawbah 9:92",
      11: "At-Tawbah 9:93 to Hud 11:5",
      12: "Hud 11:6 to Yusuf 12:52",
      13: "Yusuf 12:53 to Ibrahim 14:52",
      14: "Al-Hijr 15:1 to An-Nahl 16:128",
      15: "Al-Isra 17:1 to Al-Kahf 18:74",
      16: "Al-Kahf 18:75 to Ta-Ha 20:135",
      17: "Al-Anbiya 21:1 to Al-Hajj 22:78",
      18: "Al-Mu'minun 23:1 to Al-Furqan 25:20",
      19: "Al-Furqan 25:21 to An-Naml 27:55",
      20: "An-Naml 27:56 to Al-Ankabut 29:45",
      21: "Al-Ankabut 29:46 to Al-Ahzab 33:30",
      22: "Al-Ahzab 33:31 to Ya-Sin 36:27",
      23: "Ya-Sin 36:28 to Az-Zumar 39:31",
      24: "Az-Zumar 39:32 to Fussilat 41:46",
      25: "Fussilat 41:47 to Al-Jathiyah 45:37",
      26: "Al-Ahqaf 46:1 to Adh-Dhariyat 51:30",
      27: "Adh-Dhariyat 51:31 to Al-Hadid 57:29",
      28: "Al-Mujadilah 58:1 to At-Tahrim 66:12",
      29: "Al-Mulk 67:1 to Al-Mursalat 77:50",
      30: "An-Naba 78:1 to An-Nas 114:6"
    };
    
    return juzDescriptions[juzNumber] || `Juz ${juzNumber}`;
  }, []);
  
  const renderItem = useCallback(({ item }: { item: Verse }) => (
    <VerseItem 
      verse={item} 
      onPlayAudio={(surahNum, verseNum, globalId, repeats, isInfinite) => { /* noop for now */ }}
    />
  ), []);
  
  const keyExtractor = useCallback((item: Verse) => {
    const a = typeof item.id !== 'undefined' ? String(item.id) : '';
    const b = typeof item.verseNumber !== 'undefined' ? String(item.verseNumber) : '';
    const c = typeof (item as any).surahId !== 'undefined' ? String((item as any).surahId) : '';
    return [a, c, b].filter(Boolean).join('-');
  }, []);
  
  const ListEmptyComponent = useMemo(() => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: colors.text }]}>
        No verses available for this juz.
      </Text>
      <Pressable
        style={[styles.retryButton, { backgroundColor: colors.primary }]}
        onPress={handleRetry}
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </Pressable>
    </View>
  ), [colors, handleRetry]);
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Recite',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
              <Ionicons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      
      <View style={[styles.juzHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.juzTitle, { color: colors.text }]}>
          Juz {validJuzNumber}
        </Text>
        <Text style={[styles.juzDescription, { color: colors.inactive }]}>
          {getJuzDescription(validJuzNumber)}
        </Text>
      </View>
      
      {isLoading && verses.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading verses...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error || colors.text }]}>
            {error}
          </Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={handleRetry}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={verses}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={ListEmptyComponent}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={10}
          windowSize={10}
          getItemLayout={undefined} // Let FlatList calculate this automatically
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  juzHeader: {
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  juzTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  juzDescription: {
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  footerText: {
    marginLeft: 8,
    fontSize: 14,
  },
});