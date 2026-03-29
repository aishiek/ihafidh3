import { surahsData } from '@/data/surahs';
import { useFavouriteStore } from '@/store/favouriteStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useThemeColor } from '@/utils/useThemeColor';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ArrowLeft, Heart, Trash2 } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

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
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`;
  const wk = Math.floor(day / 7);
  if (wk < 4) return `${wk} week${wk === 1 ? '' : 's'} ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`;
  const yr = Math.floor(day / 365);
  return `${yr} year${yr === 1 ? '' : 's'} ago`;
}

// FAVOURITE CARD COMPONENT
type FavouriteCardProps = {
  item: any;
  onPress: (item: any) => void;
  onDelete: (verseId: number) => void;
  animating: boolean;
  primary: string;
  translationLanguage: string;
};

const FavouriteCard = memo(({ item, onPress, onDelete, animating, primary, translationLanguage }: FavouriteCardProps) => {
  const surahDisplayName = SURAH_NAME_MAP.get(item.surahId) || item.surahName || `Surah ${item.surahId}`;
  const [currentTranslation, setCurrentTranslation] = useState(item.translation);
  const [loading, setLoading] = useState(false);
  const isMounted = useRef(true);

  // Update translation when language changes
  useEffect(() => {
    const updateTranslation = async () => {
      if (!isMounted.current) return;
      
      setLoading(true);
      try {
        const ALQURAN_CLOUD_API = 'https://api.alquran.cloud/v1';
        const response = await fetch(
          `${ALQURAN_CLOUD_API}/ayah/${item.surahId}:${item.verseNumber}/${translationLanguage}`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch translation');
        }
        
        const data = await response.json();
        const newTranslation = data.data?.text || item.translation;
        
        if (isMounted.current) {
          setCurrentTranslation(newTranslation);
        }
      } catch (error) {
        console.warn('Failed to update translation:', error);
        if (isMounted.current) {
          setCurrentTranslation(item.translation);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    updateTranslation();

    return () => {
      isMounted.current = false;
    };
  }, [item.surahId, item.verseNumber, translationLanguage, item.translation]);
  
  return (
    <Pressable
      style={[
        styles.card,
        styles.favouriteCard,
        { borderColor: primary + '40', shadowColor: primary },
        animating ? { opacity: 0.4 } : null
      ]}
      onPress={() => onPress(item)}
    >
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardTitleSection}>
          <View style={[styles.typeBadge, { backgroundColor: '#00BCD4' }]}>
            <Heart size={14} color="#00BCD4" />
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
        {item.source === 'juz' && item.juzNumber && (
          <View style={[styles.versePill, { backgroundColor: '#4A90E2', marginLeft: 6 }]}>
            <Text style={[styles.versePillText, { color: '#fff' }]}>
              Juz {item.juzNumber}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.arabicText} numberOfLines={2}>
        {item.arabicText}
      </Text>
      <Text style={styles.translation} numberOfLines={3}>
        {loading ? 'Loading translation...' : currentTranslation}
      </Text>

      <View style={styles.cardFooterRow}>
        <Text style={styles.timeText}>{formatRelativeTime(item.createdAt)}</Text>
        <Pressable onPress={() => onDelete(item.id)} style={styles.deleteBtn}>
          <Trash2 size={16} color="#ff6b6b" />
        </Pressable>
      </View>
    </Pressable>
  );
});

// MAIN SCREEN
export default function FavouritesScreen() {
  const router = useRouter();
  const { primary } = useThemeColor();
  const { translationLanguage } = useSettingsStore();
  const { favourites, addFavourite, removeFavourite, isFavourited, clearAllFavourites } = useFavouriteStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [animatingIds, setAnimatingIds] = useState<Set<number>>(new Set());
  const [nowTick, setNowTick] = useState(Date.now());

  // Refresh time display every minute
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Filter favourites based on search
  const filteredFavourites = useMemo(() => {
    if (!searchQuery.trim()) return favourites;
    const q = searchQuery.toLowerCase();
    return favourites.filter(item => 
      (item.surahName || '').toLowerCase().includes(q) ||
      item.arabicText.includes(q) ||
      item.translation.toLowerCase().includes(q) ||
      item.surahId.toString().includes(q) ||
      item.verseNumber.toString().includes(q)
    );
  }, [favourites, searchQuery]);

  // Sort by creation date (newest first)
  const sortedFavourites = useMemo(() => {
    return [...filteredFavourites].sort((a, b) => parseDateMs(b.createdAt) - parseDateMs(a.createdAt));
  }, [filteredFavourites]);

  const handleDeleteFavourite = useCallback((verseId: number) => {
    Alert.alert(
      'Remove Favourite',
      'Are you sure you want to remove this favourite verse?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setAnimatingIds(prev => new Set(prev).add(verseId));
            try {
              removeFavourite(verseId);
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
      ]
    );
  }, [removeFavourite]);

  const handleCardPress = useCallback((item: any) => {
    Haptics.selectionAsync().catch(() => {});
    
    // Navigate based on favourite source
    if (item.source === 'juz' && item.juzNumber) {
      // Navigate to Juz mode with specific verse
      router.push(`/(tabs)/read?juzNumber=${item.juzNumber}&verseId=${item.id}`);
    } else {
      // Navigate to Surah mode
      router.push(`/(tabs)/read?surahId=${item.surahId}&verseId=${item.id}`);
    }
  }, [router]);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear All Favourites',
      'Are you sure you want to remove all favourites?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            clearAllFavourites();
          },
        },
      ]
    );
  }, [clearAllFavourites]);

  const renderFavourite = useCallback(
    ({ item }: any) => (
      <FavouriteCard
        item={item}
        onPress={handleCardPress}
        onDelete={handleDeleteFavourite}
        animating={animatingIds.has(item.id)}
        primary={primary}
        translationLanguage={translationLanguage}
      />
    ),
    [handleCardPress, handleDeleteFavourite, animatingIds, primary, translationLanguage]
  );

  return (
    <View style={[styles.container, { backgroundColor: '#1a1a1a' }]}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginRight: 12 }}>
            <ArrowLeft size={28} color="#00BCD4" />
          </TouchableOpacity>
          <View style={[styles.headerTitleRow, { flex: 1 }]}> 
            <Text style={[styles.headerTitle, { color: '#00BCD4' }]}>My Favourites</Text>
          </View>
        </View>
      </View>

      {/* Favourite count and actions row */}
      <View style={styles.favouriteActionsRow}>
        <Text style={styles.countText}>
          {sortedFavourites.length} favourite{sortedFavourites.length !== 1 ? 's' : ''}
        </Text>
        {sortedFavourites.length > 0 && (
          <Pressable onPress={handleClearAll} style={styles.clearAllBtn}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </Pressable>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          placeholder="Search favourites..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />
      </View>

      {/* Favourites List */}
      {sortedFavourites.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Heart size={48} color="#00BCD4" />
          <Text style={[styles.emptyTitle, { color: '#fff' }]}>No Favourites Yet</Text>
          <Text style={[styles.emptySubtitle, { color: '#888' }]}>
            Start adding your favourite verses to see them here
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedFavourites}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderFavourite}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={false}
              tintColor={primary}
              colors={[primary]}
            />
          }
        />
      )}
    </View>
  );
}

// STYLES - Matching Bookmarks but with golden theme
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingTop: 44,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  favouriteActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  countText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00BCD4',
  },
  languageText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#888',
    marginLeft: 12,
    backgroundColor: 'rgba(0, 188, 212, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clearAllBtn: {
    backgroundColor: 'rgba(0, 188, 212, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearAllText: {
    color: '#00BCD4',
    fontSize: 14,
    fontWeight: '600',
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderColor: '#333',
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  // Card styles - similar to bookmarks but with golden theme
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  favouriteCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#00BCD4',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  surahName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  versePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  versePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  arabic: {
    fontSize: 18,
    color: '#FFD700',
    lineHeight: 28,
    marginBottom: 8,
    textAlign: 'right',
    fontFamily: 'Amiri-Regular',
  },
  arabicText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'KFGQPC-Uthman-Taha',
    writingDirection: 'rtl',
  },
  translation: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: '#888',
  },
  deleteBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
});
