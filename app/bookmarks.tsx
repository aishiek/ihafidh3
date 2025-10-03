import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, TouchableOpacity } from 'react-native';
import { useBookmarkStore } from '@/store/bookmarkStore';
import { useThemeColor } from '@/utils/useThemeColor';
import { Bookmark as BookmarkIcon, ArrowLeft, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import { surahsData } from '@/data/surahs';

// Build a static map of surahId -> display name for fast lookup
const SURAH_NAME_MAP = new Map<number, string>(surahsData.map(s => [s.id, s.name]));

const THRESHOLD_SEARCH = 100; // show search when >= 100 bookmarks

// Safe date parse for both ISO (with T) and SQLite CURRENT_TIMESTAMP format (YYYY-MM-DD HH:MM:SS)
function parseDateMs(input: string): number {
  if (!input) return Date.now();
  if (input.includes('T')) {
    const ms = Date.parse(input);
    return isNaN(ms) ? Date.now() : ms;
  }
  // Likely "YYYY-MM-DD HH:MM:SS" (UTC from SQLite). Convert to ISO.
  const iso = input.replace(' ', 'T') + 'Z';
  const ms = Date.parse(iso);
  return isNaN(ms) ? Date.now() : ms;
}

function formatRelativeTime(createdAt: string): string {
  const now = Date.now();
  const t = parseDateMs(createdAt);
  const diff = Math.max(0, now - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return 'Just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day} days ago`;
  const week = Math.floor(day / 7);
  if (week < 5) return `${week} week${week === 1 ? '' : 's'} ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} month${month === 1 ? '' : 's'} ago`;
  const year = Math.floor(day / 365);
  return `${year} year${year === 1 ? '' : 's'} ago`;
}

type CardProps = {
  item: any;
  onPress: (item: any) => void;
  onDelete: (verseId: number) => void;
  animating: boolean;
  primary: string;
  nowTick: number; // forces re-render each minute for live time updates
};

const BookmarkCard = memo(({ item, onPress, onDelete, animating, primary }: CardProps) => {
  const surahDisplayName = SURAH_NAME_MAP.get(item.surahId) || item.surahName || `Surah ${item.surahId}`;
  return (
    <Pressable
      style={[styles.card, { borderColor: '#555', shadowColor: '#000' }, animating ? { opacity: 0.4 } : null]}
      onPress={() => onPress(item)}
    >
      <View style={styles.cardHeaderRow}>
        <Text style={[styles.surahName, { color: '#fff' }]} numberOfLines={1}>{surahDisplayName}</Text>
        <View style={styles.pillRow}>
          <View style={[styles.versePill, { backgroundColor: primary }]}>
            <Text style={[styles.versePillText, { color: '#000' }]}>Surah {item.surahId}</Text>
          </View>
          <View style={[styles.versePill, { backgroundColor: primary, marginLeft: 6 }]}>
            <Text style={[styles.versePillText, { color: '#000' }]}>Verse {item.verseNumber}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.arabic} numberOfLines={3}>{item.arabicText}</Text>
      <Text style={styles.translation} numberOfLines={3}>{item.translation}</Text>
      <View style={styles.cardFooterRow}>
        <Text style={styles.timeText}>{formatRelativeTime(item.createdAt)}</Text>
        <Pressable onPress={() => onDelete(item.verseId)} style={styles.deleteBtn}>
          <Trash2 size={16} color="#ff6b6b" />
        </Pressable>
      </View>
    </Pressable>
  );
});

export default function BookmarksScreen() {
  const { primary } = useThemeColor();
  const router = useRouter();
  const { bookmarks, reloadBookmarks, removeBookmark, clearAllBookmarks } = useBookmarkStore();
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [animatingIds, setAnimatingIds] = useState<Set<number>>(new Set());
  const [nowTick, setNowTick] = useState(0);

  // Single interval to update relative time labels every minute (no per-card timers)
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Lazy load on focus only
  useFocusEffect(
    useCallback(() => {
      reloadBookmarks().catch(() => {});
    }, [reloadBookmarks])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reloadBookmarks();
    } finally {
      setRefreshing(false);
    }
  }, [reloadBookmarks]);

  const data = useMemo(() => {
    const list = bookmarks || [];
    if (!query.trim()) return list;
    const q = query.trim().toLowerCase();
    return list.filter(b => b.surahName.toLowerCase().includes(q));
  }, [bookmarks, query]);

  const handleClearAll = useCallback(() => {
    if (!bookmarks?.length) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert('Clear all bookmarks?', 'This will remove all saved bookmarks.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: async () => {
        try {
          await clearAllBookmarks();
        } catch {}
      }},
    ]);
  }, [bookmarks, clearAllBookmarks]);

  const handleDelete = useCallback((verseId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Alert.alert('Remove bookmark?', 'This will remove this bookmark.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        setAnimatingIds(prev => new Set(prev).add(verseId));
        try {
          await removeBookmark(verseId);
        } finally {
          setTimeout(() => {
            setAnimatingIds(prev => { const n = new Set(prev); n.delete(verseId); return n; });
          }, 200);
        }
      }},
    ]);
  }, [removeBookmark]);

  const onCardPress = useCallback((item: any) => {
    Haptics.selectionAsync().catch(() => {});
    router.push(`/(tabs)/read?surahId=${item.surahId}&verseId=${item.verseNumber}`);
  }, [router]);

  const renderItem = useCallback(({ item }: any) => (
    <BookmarkCard
      item={item}
      onPress={onCardPress}
      onDelete={handleDelete}
      animating={animatingIds.has(item.verseId)}
      primary={primary}
      nowTick={nowTick}
    />
  ), [animatingIds, primary, handleDelete, onCardPress, nowTick]);

  const keyExtractor = useCallback((item: any) => `${item.verseId}`, []);

  const showSearch = data.length >= THRESHOLD_SEARCH;

  return (
    <View style={[styles.container, { backgroundColor: '#1a1a1a' }]}> 
      {/* Header (match read.tsx) */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginRight: 12 }}>
            <ArrowLeft size={28} color="#FFD700" />
          </TouchableOpacity>
          <View style={[styles.headerTitleRow, { flex: 1 }]}>
            <BookmarkIcon size={20} color="#FFD700" />
            <Text style={styles.headerTitle}>My Bookmarks</Text>
          </View>
        </View>
      </View>

      {/* Bookmark count and actions row */}
      <View style={styles.bookmarkActionsRow}>
        <Text style={styles.countText}>{bookmarks.length} {bookmarks.length === 1 ? 'bookmark' : 'bookmarks'}</Text>
        {bookmarks.length > 0 && (
          <Pressable onPress={handleClearAll} style={styles.clearAllBtn}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </Pressable>
        )}
      </View>

      {/* Search */}
      {showSearch && (
        <View style={styles.searchWrap}>
          <TextInput
            placeholder="Search by surah name"
            placeholderTextColor="#888"
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
          />
        </View>
      )}

      {/* Empty State */}
      {bookmarks.length === 0 ? (
        <View style={styles.emptyState}>
          <BookmarkIcon size={80} color="#555" />
          <Text style={styles.emptyTitle}>No bookmarks yet</Text>
          <Text style={styles.emptySubtitle}>Tap the bookmark icon on any verse to save it here</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          refreshControl={<RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingVertical: 8 }}
          windowSize={10}
          maxToRenderPerBatch={5}
          initialNumToRender={10}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: {
    paddingTop: 44,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  bookmarkActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginLeft: 8 },
  countText: { color: '#aaa', fontSize: 12, marginRight: 8 },
  clearAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)'
  },
  clearAllText: { color: '#ff6b6b', fontWeight: '600' },
  searchWrap: { paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: { color: '#ddd', fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptySubtitle: { color: '#aaa', fontSize: 14, marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: '#333',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 8,
    borderWidth: 1,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  surahName: { fontSize: 18, fontWeight: '700' },
  pillRow: { flexDirection: 'row', alignItems: 'center' },
  versePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, },
  versePillText: { fontSize: 12, fontWeight: '700' },
  arabic: { color: '#fff', fontSize: 20, marginTop: 10 },
  translation: { color: '#aaa', fontSize: 14, marginTop: 6 },
  cardFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  timeText: { color: '#aaa', fontSize: 12 },
  deleteBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)' },
});