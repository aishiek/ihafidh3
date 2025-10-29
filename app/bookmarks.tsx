import { surahsData } from '@/data/surahs';
import { useBookmarkStore } from '@/store/bookmarkStore';
import { useThemeColor } from '@/utils/useThemeColor';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Bookmark, Bookmark as BookmarkIcon, BookOpen, ChevronRight, Trash2 } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  // SegmentedControlIOS,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useMushafBookmarks } from './mushaf/hooks/useMushafBookmarks';

// Static map for fast surah lookup
const SURAH_NAME_MAP = new Map<number, string>(surahsData.map(s => [s.id, s.name]));
const THRESHOLD_SEARCH = 100;

// Safe date parsing for ISO and SQLite formats
function parseDateMs(input: string): number {
  if (!input) return Date.now();
  if (input.includes('T')) {
    const ms = Date.parse(input);
    return isNaN(ms) ? Date.now() : ms;
  }
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

// APP BOOKMARK CARD
type AppBookmarkCardProps = {
  item: any;
  onPress: (item: any) => void;
  onDelete: (verseId: number) => void;
  animating: boolean;
  primary: string;
  nowTick: number;
};

const AppBookmarkCard = memo(({ item, onPress, onDelete, animating, primary }: AppBookmarkCardProps) => {
  const surahDisplayName = SURAH_NAME_MAP.get(item.surahId) || item.surahName || `Surah ${item.surahId}`;
  
  return (
    <Pressable
      style={[
        styles.card,
        styles.appCard,
        { borderColor: primary + '40', shadowColor: primary },
        animating ? { opacity: 0.4 } : null
      ]}
      onPress={() => onPress(item)}
    >
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardTitleSection}>
          <View style={[styles.typeBadge, { backgroundColor: primary + '20' }]}>
            <BookmarkIcon size={14} color={primary} />
          </View>
          <Text style={[styles.surahName, { color: '#fff' }]} numberOfLines={1}>
            {surahDisplayName}
          </Text>
        </View>
      </View>

      <View style={styles.pillRow}>
        <View style={[styles.versePill, { backgroundColor: primary }]}>
          <Text style={[styles.versePillText, { color: '#000' }]}>
            Surah {item.surahId}
          </Text>
        </View>
        <View style={[styles.versePill, { backgroundColor: primary, marginLeft: 6 }]}>
          <Text style={[styles.versePillText, { color: '#000' }]}>
            Verse {item.verseNumber}
          </Text>
        </View>
      </View>

      <Text style={styles.arabic} numberOfLines={3}>
        {item.arabicText}
      </Text>
      <Text style={styles.translation} numberOfLines={3}>
        {item.translation}
      </Text>

      <View style={styles.cardFooterRow}>
        <Text style={styles.timeText}>{formatRelativeTime(item.createdAt)}</Text>
        <Pressable onPress={() => onDelete(item.verseId)} style={styles.deleteBtn}>
          <Trash2 size={16} color="#ff6b6b" />
        </Pressable>
      </View>
    </Pressable>
  );
});

// MUSHAF BOOKMARK CARD
type MushafBookmarkCardProps = {
  page: number;
  onPress: (page: number) => void;
  onDelete: (page: number) => void;
  animating: boolean;
  primary: string;
};

// ...existing code...
import { getPageInfo, initMushafDB } from './mushaf/services/mushafMetadataService';

const MushafBookmarkCard = memo(({ page, onPress, onDelete, animating, primary }: MushafBookmarkCardProps) => {
  const [surahName, setSurahName] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const db = await initMushafDB();
        const pageInfo = await getPageInfo(db, page);
        if (isMounted) {
          // Try to get surah name from metadata, fallback to Surah number
          let name = null;
          if (pageInfo?.surah_number) {
            const surahData = surahsData.find(s => s.id === pageInfo.surah_number);
            name = surahData?.name || `Surah ${pageInfo.surah_number}`;
          }
          setSurahName(name);
        }
      } catch {
        if (isMounted) setSurahName(null);
      }
    })();
    return () => { isMounted = false; };
  }, [page]);

  // Use surahName if available, else fallback to just page number
  const displaySurah = surahName ? surahName : `Page ${page}`;

  return (
    <Pressable
      style={[
        styles.mushafCard,
        { borderColor: '#2563eb33', backgroundColor: '#19223c', shadowColor: '#2563eb' },
        animating ? { opacity: 0.4 } : null
      ]}
      onPress={() => onPress(page)}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Page Badge */}
        <View style={{ width: 56, height: 56, backgroundColor: '#2563eb', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16, shadowColor: '#2563eb', shadowOpacity: 0.15, shadowRadius: 6, elevation: 2 }}>
          <Text style={{ color: '#b3caff', fontSize: 11, fontWeight: '600' }}>PAGE</Text>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 2 }}>{page}</Text>
        </View>
        {/* Info */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 }} numberOfLines={1}>{displaySurah}</Text>
          <Text style={{ color: '#94a3b8', fontSize: 13 }}>Tap to view in Mushaf reader</Text>
        </View>
        {/* Actions */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => onDelete(page)} style={{ padding: 8, borderRadius: 8 }}>
            <Trash2 size={18} color="#ff6b6b" />
          </Pressable>
          <ChevronRight size={18} color="#2563eb" />
        </View>
      </View>
      {/* Saved Indicator */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 }}>
        <Bookmark size={12} color="#2563eb" />
        <Text style={{ color: '#2563eb', fontSize: 12, fontWeight: '500' }}>Saved to collection</Text>
      </View>
    </Pressable>
  );
});

export default function BookmarksScreen() {
  const { primary } = useThemeColor();
  const router = useRouter();
  
  // App bookmarks
  const { bookmarks, reloadBookmarks, removeBookmark, clearAllBookmarks } = useBookmarkStore();
  
  // Mushaf bookmarks
  const { bookmarks: mushafBookmarks, toggleBookmark: toggleMushafBookmark } = useMushafBookmarks();

  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [animatingIds, setAnimatingIds] = useState<Set<number>>(new Set());
  const [animatingMushafPages, setAnimatingMushafPages] = useState<Set<number>>(new Set());
  const [nowTick, setNowTick] = useState(0);
  const [tab, setTab] = useState<'app' | 'mushaf'>('app');
  const [segmentIndex, setSegmentIndex] = useState(0);

  // Update relative times every minute
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Lazy load on focus
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

  // Filter app bookmarks
  const filteredAppBookmarks = useMemo(() => {
    const list = bookmarks || [];
    if (!query.trim()) return list;
    const q = query.trim().toLowerCase();
    return list.filter(b => b.surahName.toLowerCase().includes(q));
  }, [bookmarks, query]);

  // Filter mushaf bookmarks
  const filteredMushafBookmarks = useMemo(() => {
  const pages = Array.from(mushafBookmarks as Set<number> || []).sort((a, b) => (b as number) - (a as number));
    if (!query.trim()) return pages;
    const q = query.trim().toLowerCase();
    return pages.filter(p => {
      // Find surah name for this page
      let surahNum = 1;
      for (let i = surahsData.length - 1; i >= 0; i--) {
  if ((surahsData[i] as any).page && (surahsData[i] as any).page <= (p as number)) {
          surahNum = surahsData[i].id;
          break;
        }
      }
      const surahName = SURAH_NAME_MAP.get(surahNum) || `Surah ${surahNum}`;
      return surahName.toLowerCase().includes(q) || `page ${p}`.includes(q);
    });
  }, [mushafBookmarks, query]);

  const handleClearAll = useCallback(() => {
    const isAppTab = tab === 'app';
    const count = isAppTab ? bookmarks?.length : mushafBookmarks.size;
    
    if (!count) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert(
      `Clear all ${isAppTab ? 'app' : 'mushaf'} bookmarks?`,
      `This will remove all ${count} saved ${isAppTab ? 'verse' : 'page'} bookmarks.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            if (isAppTab) {
              try {
                await clearAllBookmarks();
              } catch {}
            } else {
              // Clear all mushaf bookmarks
              for (const page of mushafBookmarks) {
                toggleMushafBookmark(page);
              }
            }
          },
        },
      ]
    );
  }, [bookmarks, mushafBookmarks, clearAllBookmarks, toggleMushafBookmark, tab]);

  const handleDeleteAppBookmark = useCallback((verseId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Alert.alert('Remove bookmark?', 'This will remove this bookmark.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setAnimatingIds(prev => new Set(prev).add(verseId));
          try {
            await removeBookmark(verseId);
          } finally {
            setTimeout(() => {
              setAnimatingIds(prev => {
                const n = new Set(prev);
                n.delete(verseId);
                return n;
              });
            }, 200);
          }
        },
      },
    ]);
  }, [removeBookmark]);

  const handleDeleteMushafBookmark = useCallback((page: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Alert.alert('Remove bookmark?', 'This will remove this page bookmark.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setAnimatingMushafPages(prev => new Set(prev).add(page));
          try {
            toggleMushafBookmark(page);
          } finally {
            setTimeout(() => {
              setAnimatingMushafPages(prev => {
                const n = new Set(prev);
                n.delete(page);
                return n;
              });
            }, 200);
          }
        },
      },
    ]);
  }, [toggleMushafBookmark]);

  const handleAppCardPress = useCallback((item: any) => {
    Haptics.selectionAsync().catch(() => {});
    // Route to exact verse - verseNumber is the verse ID
    router.push(`/(tabs)/read?surahId=${item.surahId}&verseId=${item.verseNumber}`);
  }, [router]);

  const handleMushafCardPress = useCallback((page: number) => {
    Haptics.selectionAsync().catch(() => {});
    // Route to exact mushaf page
    router.push(`/mushaf?pageNumber=${page}`);
  }, [router]);

  const renderAppItem = useCallback(
    ({ item }: any) => (
      <AppBookmarkCard
        item={item}
        onPress={handleAppCardPress}
        onDelete={handleDeleteAppBookmark}
        animating={animatingIds.has(item.verseId)}
        primary={primary}
        nowTick={nowTick}
      />
    ),
    [animatingIds, primary, handleDeleteAppBookmark, handleAppCardPress, nowTick]
  );

  const renderMushafItem = useCallback(
  ({ item }: { item: number }) => (
      <MushafBookmarkCard
        page={item}
        onPress={handleMushafCardPress}
        onDelete={handleDeleteMushafBookmark}
        animating={animatingMushafPages.has(item)}
        primary={primary}
      />
    ),
    [animatingMushafPages, primary, handleDeleteMushafBookmark, handleMushafCardPress]
  );

  const keyExtractor = useCallback((item: any) => `${item.verseId || item}`, []);

  const showSearch = 
    (tab === 'app' && filteredAppBookmarks.length >= THRESHOLD_SEARCH) ||
    (tab === 'mushaf' && filteredMushafBookmarks.length >= THRESHOLD_SEARCH);

  const currentCount = tab === 'app' ? bookmarks?.length || 0 : mushafBookmarks.size || 0;
  const currentData = tab === 'app' ? filteredAppBookmarks : filteredMushafBookmarks;
  const isEmpty = currentCount === 0;

  const handleTabChange = (index: number) => {
    setSegmentIndex(index);
    setTab(index === 0 ? 'app' : 'mushaf');
    setQuery(''); // Reset search when switching tabs
  };

  return (
    <View style={[styles.container, { backgroundColor: '#1a1a1a' }]}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginRight: 12 }}>
            <ArrowLeft size={28} color="#FFD60A" />
          </TouchableOpacity>
          <View style={[styles.headerTitleRow, { flex: 1 }]}> 
            <BookmarkIcon size={20} color="#FFD60A" />
            <Text style={[styles.headerTitle, { color: '#FFD60A' }]}>My Bookmarks</Text>
          </View>
        </View>
      </View>

      {/* Tab Selector */}
      {Platform.OS === 'ios' ? (
        <View style={styles.tabContainer}>
          {/* Custom themed tab selector with theme blue */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', margin: 12 }}>
            {[{ key: 'app', label: 'App' }, { key: 'mushaf', label: 'Mushaf' }].map(({ key, label }) => {
              const isActive = tab === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => handleTabChange(key === 'app' ? 0 : 1)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    marginHorizontal: 4,
                    borderRadius: 8,
                    backgroundColor: isActive ? primary : '#F8F9FA',
                    borderWidth: isActive ? 0 : 1,
                    borderColor: '#D0D5DC',
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{
                    color: isActive ? '#FFFFFF' : '#1A1A1A',
                    fontWeight: isActive ? '700' : '500',
                    fontSize: 16,
                    textAlign: 'center',
                  }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={styles.tabContainerAndroid}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              tab === 'app' && [styles.tabButtonActive, { backgroundColor: primary }],
            ]}
            onPress={() => handleTabChange(0)}
          >
            <BookmarkIcon size={16} color={tab === 'app' ? '#000' : '#aaa'} />
            <Text style={[styles.tabButtonText, tab === 'app' && { color: '#000', fontWeight: '700' }]}>
              App Verses
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              tab === 'mushaf' && [styles.tabButtonActive, { backgroundColor: primary }],
            ]}
            onPress={() => handleTabChange(1)}
          >
            <BookOpen size={16} color={tab === 'mushaf' ? '#000' : '#aaa'} />
            <Text style={[styles.tabButtonText, tab === 'mushaf' && { color: '#000', fontWeight: '700' }]}>
              Mushaf Pages
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bookmark count and actions row */}
      <View style={styles.bookmarkActionsRow}>
        <Text style={styles.countText}>
          {currentCount} {tab === 'app' ? (currentCount === 1 ? 'bookmark' : 'bookmarks') : (currentCount === 1 ? 'page' : 'pages')}
        </Text>
        {currentCount > 0 && (
          <Pressable onPress={handleClearAll} style={styles.clearAllBtn}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </Pressable>
        )}
      </View>

      {/* Search */}
      {showSearch && (
        <View style={styles.searchWrap}>
          <TextInput
            placeholder={`Search ${tab === 'app' ? 'by surah name' : 'by page or surah'}`}
            placeholderTextColor="#888"
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
          />
        </View>
      )}

      {/* Empty State */}
      {isEmpty ? (
        <View style={styles.emptyState}>
          {tab === 'app' ? (
            <>
              <BookmarkIcon size={80} color="#555" />
              <Text style={styles.emptyTitle}>No app bookmarks yet</Text>
              <Text style={styles.emptySubtitle}>Tap the bookmark icon on any verse to save it here</Text>
            </>
          ) : (
            <>
              <BookOpen size={80} color="#555" />
              <Text style={styles.emptyTitle}>No Mushaf bookmarks yet</Text>
              <Text style={styles.emptySubtitle}>Mark pages in the Mushaf reader to save them here</Text>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={keyExtractor}
          renderItem={tab === 'app' ? renderAppItem : renderMushafItem as any}
          refreshControl={<RefreshControl tintColor={primary} refreshing={refreshing} onRefresh={onRefresh} />}
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
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginLeft: 8 },
  tabContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
  },
  segmentControl: {
    height: 32,
  },
  tabContainerAndroid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#333',
    gap: 6,
  },
  tabButtonActive: {
    borderColor: 'transparent',
  },
  tabButtonText: { color: '#aaa', fontWeight: '600', fontSize: 12 },
  bookmarkActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
  },
  countText: { color: '#aaa', fontSize: 12, marginRight: 8 },
  clearAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  clearAllText: { color: '#ff6b6b', fontWeight: '600' },
  searchWrap: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#1a1a1a' },
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
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 8,
    borderWidth: 1.5,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  appCard: {
    // Additional styling for app bookmarks
  },
  mushafCard: {
    // Additional styling for mushaf bookmarks
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  typeBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  surahName: { fontSize: 16, fontWeight: '700', flex: 1 },
  subtitleText: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  pillRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  versePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  versePillText: { fontSize: 11, fontWeight: '700' },
  arabic: { color: '#fff', fontSize: 18, marginBottom: 8, lineHeight: 28 },
  translation: { color: '#bbb', fontSize: 13, marginBottom: 12, lineHeight: 20 },
  mushafPreview: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginVertical: 12,
  },
  mushafPageNumber: { fontSize: 24, fontWeight: '700', marginBottom: 6 },
  mushafHint: { fontSize: 12, color: '#aaa', fontStyle: 'italic' },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  timeText: { color: '#777', fontSize: 12 },
  deleteBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)' },
});