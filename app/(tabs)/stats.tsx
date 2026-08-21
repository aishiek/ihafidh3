import QURANIC_DUAS_DATA from '@/data/quranic-duas.json';
import { surahsData } from '@/data/surahs';
import { useProgressStore } from '@/store/progressStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { QuranicDua } from '@/types/duas';
import { logAnalyticsEvent } from '@/utils/analyticsHelper';
import { useCommunityStatsFlag } from '@/utils/communityStatsFlag';
import { fetchAllStats, subscribeToGlobalStats, CommunityStatsData } from '@/services/communityStatsService';
import { calculateDuaStats } from '@/utils/duaHelpers';
import { calculateJuzProgress, calculateOverallJuzStats } from '@/utils/juzCalculator';
import { useCustomColors } from '@/utils/themeUtils';
import { useThemeColor } from '@/utils/useThemeColor';
import { useRouter } from 'expo-router';
import { BookOpen, Globe, Sparkles, TrendingUp, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// Remove unused import - now using calculateJuzProgress from juzCalculator
import CircularProgress from '@/components/CircularProgress';
import ActivityBarChart from '@/components/stats/ActivityBarChart';
import ActivityTimeSeriesGraph from '@/components/stats/ActivityTimeSeriesGraph';
import HeatmapCalendar from '@/components/stats/HeatmapCalendar';
import HighestStatsCard from '@/components/stats/HighestStatsCard';
import LifetimeProgressCard from '@/components/stats/LifetimeProgressCard';
import VerseProgressCard from '@/components/stats/VerseProgressCard';
import { useQuranStore } from '@/store/quranStore';

interface ProgressTrackerData {
  memorizedVerses: string[];
}

interface ProgressResult {
  verses: {
    completed: number;
    total: number;
    percentage: number;
  };
  surahs: {
    completed: number;
    total: number;
    percentage: number;
  };
  juz: {
    completed: number;
    total: number;
    percentage: number;
  };
}

interface JuzProgressData {
  [key: number]: {
    memorized: number;
    total: number;
    progress: number;
  };
}

// Simple QuranProgressTracker implementation
class QuranProgressTracker {
  private memorizedVerses: string[];

  constructor(data: ProgressTrackerData) {
    this.memorizedVerses = data.memorizedVerses || [];
  }

  calculateProgress(): ProgressResult {
    const totalVerses = surahsData.reduce((sum, surah) => sum + surah.versesCount, 0);
    const totalSurahs = surahsData.length;
    const totalJuz = 30;

    // Calculate verse progress
    const memorizedVerseCount = this.memorizedVerses.length;
    const versePercentage = totalVerses > 0 ? (memorizedVerseCount / totalVerses) * 100 : 0;

    // Calculate surah progress (simplified - count surahs with any memorized verses)
    const memorizedSurahs = new Set<string>();
    this.memorizedVerses.forEach((verseRef: string) => {
      const surahId = verseRef.split(':')[0];
      memorizedSurahs.add(surahId);
    });

    const surahPercentage = totalSurahs > 0 ? (memorizedSurahs.size / totalSurahs) * 100 : 0;

    // Calculate juz progress (simplified - will be updated by actual juz data)
    // This is a placeholder - actual juz progress is calculated from database
    const juzPercentage = 0; // Will be calculated from juzProgressData

    return {
      verses: {
        completed: memorizedVerseCount,
        total: totalVerses,
        percentage: versePercentage
      },
      surahs: {
        completed: memorizedSurahs.size,
        total: totalSurahs,
        percentage: surahPercentage
      },
      juz: {
        completed: 0, // Will be calculated from actual juz data
        total: totalJuz,
        percentage: juzPercentage
      }
    };
  }
}

const DIVISIONS = [
  {
    id: 'tiwal',
    name: 'At-Tiwal',
    arabic: 'الطُّوَل',
    description: '"The Long Ones" — The seven longest surahs of the Quran. These form the foundation of Quran memorization and are the most voluminous in content and rulings.',
    range: 'Surah Al-Baqarah (2) – Surah At-Tawbah (9)',
    surahs: [2, 3, 4, 5, 6, 7, 8, 9] // 8 Surahs (some count 8 & 9 as one)
  },
  {
    id: 'miun',
    name: "Al-Mi'un",
    arabic: 'المِئُون',
    description: '"The Hundreds" — Surahs each containing approximately one hundred verses or close to it. They follow At-Tiwal.',
    range: 'Surah Yunus (10) – Surah As-Sajdah (32)',
    surahs: Array.from({length: 23}, (_, i) => i + 10) // 10 to 32
  },
  {
    id: 'mathani',
    name: 'Al-Mathani',
    arabic: 'المَثَاني',
    description: '"The Oft-Repeated" — Surahs shorter than Al-Mi\'un but rich in frequently repeated themes, supplications, and narratives.',
    range: 'Surah Al-Fatihah (1) & Surah Al-Ahzab (33) – Surah Al-Hujurat (49)',
    surahs: [1, ...Array.from({length: 17}, (_, i) => i + 33)] // 1, 33 to 49
  },
  {
    id: 'mufassal',
    name: 'Al-Mufassal',
    arabic: 'المُفَصَّل',
    description: '"The Detailed/Separated" — The final and most numerous group. Called "Mufassal" because of the frequent Bismillah separating short surahs.',
    range: 'Surah Qaf (50) – Surah An-Nas (114)',
    surahs: Array.from({length: 65}, (_, i) => i + 50) // 50 to 114
  }
];

export default function StatsScreen() {
  const router = useRouter();
  const colors = useCustomColors();
  const { primary } = useThemeColor();
  const { userName } = useSettingsStore();

  const [viewMode, setViewMode] = useState<'surah' | 'juz'>('juz');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [infoDivision, setInfoDivision] = useState<any>(null);
  const [juzProgressData, setJuzProgressData] = useState<JuzProgressData>({});
  const [heatmapType, setHeatmapType] = useState<'memorized' | 'revised'>('memorized');
  const [activityData, setActivityData] = useState<{
    memorizedVerses: Array<{ date: string; count: number }>;
    revisedVerses: Array<{ date: string; count: number }>;
  }>({ memorizedVerses: [], revisedVerses: [] });

  // Community Stats
  const { enabled: communityStatsEnabled, minThreshold } = useCommunityStatsFlag();
  const [communityStats, setCommunityStats] = useState<CommunityStatsData | null>(null);
  const [communityStatsLoading, setCommunityStatsLoading] = useState(false);

  useEffect(() => {
    if (!communityStatsEnabled) return;
    let cancelled = false;
    setCommunityStatsLoading(true);
    fetchAllStats().then(data => {
      if (!cancelled) { setCommunityStats(data); setCommunityStatsLoading(false); }
    }).catch(() => { if (!cancelled) setCommunityStatsLoading(false); });

    const unsubscribe = subscribeToGlobalStats((liveGlobal) => {
      if (!cancelled) {
        setCommunityStats(prev => prev ? { ...prev, global: liveGlobal } : {
          global: liveGlobal,
          surahs: new Map(),
          juz: new Map(),
          badges: new Map(),
          timestamp: Date.now()
        });
        setCommunityStatsLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [communityStatsEnabled]);

  const [pageActivityData, setPageActivityData] = useState<{
    memorizedPages: Array<{ date: string; count: number }>;
    revisedPages: Array<{ date: string; count: number }>;
  }>({ memorizedPages: [], revisedPages: [] });

  const { memorizedVerses, revisedVerses, getActivityData, getPageActivityData } = useProgressStore();

  // Load activity data from database
  useEffect(() => {
    let mounted = true;

    const loadActivityData = async () => {
      try {
        if (__DEV__) console.log('[stats] Loading activity data from database...');
        const data = await getActivityData();

        if (mounted) {
          if (__DEV__) {
            console.log('[stats] Activity Data loaded:', {
              memorizedCount: data.memorizedVerses.length,
              revisedCount: data.revisedVerses.length,
              memorizedSample: data.memorizedVerses.slice(0, 3),
              revisedSample: data.revisedVerses.slice(0, 3),
              totalMemorized: data.memorizedVerses.reduce((sum, d) => sum + d.count, 0),
              totalRevised: data.revisedVerses.reduce((sum, d) => sum + d.count, 0),
            });
          }
          setActivityData(data);

          const pageData = getPageActivityData();
          setPageActivityData(pageData);
        }
      } catch (error) {
        console.error('[stats] Error loading activity data:', error);
      }
    };

    loadActivityData();

    return () => {
      mounted = false;
    };
  }, [getActivityData, memorizedVerses, revisedVerses]); // Reload when memorizedVerses OR revisedVerses changes

  // ANALYTICS: Track stats tab view on mount
  useEffect(() => {
    logAnalyticsEvent('stats_tab_viewed', {
      memorized_verses_count: memorizedVerses.length,
      revised_verses_count: revisedVerses.length,});
  }, []);

  // Initialize progress tracker with current memorized verses
  const progressTracker = useMemo(() => {
    return new QuranProgressTracker({
      memorizedVerses: memorizedVerses.map(verseId => {
        // Convert verseId to surah:verse format for the tracker
        let startVerseId = 0;
        for (let i = 1; i <= 114; i++) {
          const surah = surahsData.find(s => s.id === i);
          if (!surah) continue;

          if (verseId <= startVerseId + surah.versesCount) {
            const verseNumber = verseId - startVerseId;
            return `${i}:${verseNumber}`;
          }
          startVerseId += surah.versesCount;
        }
        return '';
      }).filter(Boolean)
    });
  }, [memorizedVerses]);

  const progress = progressTracker.calculateProgress();

  // Use proper Juz calculation (sync with Home page)
  const calculateOverallJuzProgress = () => {
    const stats = calculateOverallJuzStats(memorizedVerses);
    return {
      completed: stats.completed,
      inProgress: stats.inProgress,
      total: stats.totalJuz,
      percentage: stats.percentage
    };
  };

  // Update progress with actual juz data
  // Calculate memorization for each surah
  const calculateSurahProgress = (surahId: number) => {
    let startVerseId = 0;
    for (let i = 1; i < surahId; i++) {
      const prevSurah = surahsData.find(s => s.id === i);
      if (prevSurah) startVerseId += prevSurah.versesCount;
    }

    const surah = surahsData.find(s => s.id === surahId);
    if (!surah) return { memorized: 0, progress: 0 };

    const startVerse = startVerseId + 1;
    const endVerse = startVerseId + surah.versesCount;

    const memorizedInSurah = memorizedVerses.filter(id => id >= startVerse && id <= endVerse).length;
    const progressPercentage = (memorizedInSurah / surah.versesCount) * 100;

    return { memorized: memorizedInSurah, progress: progressPercentage };
  };

  // Get juz progress (now synchronous)
  const getJuzProgressSync = (juzNumber: number) => {
    const juzData = juzProgressData[juzNumber];
    if (juzData) {
      // Ensure we don't return NaN values
      const memorized = juzData.memorized || 0;
      const total = juzData.total || 0;
      const progress = total > 0 ? (memorized / total) * 100 : 0;

      return {
        memorized,
        total,
        progress: Math.round(progress)
      };
    }
    // Return default values if data not loaded yet
    return { memorized: 0, total: 0, progress: 0 };
  };

  const getProgressColor = (progress: number) => {
    // Handle NaN and invalid values
    if (isNaN(progress) || progress === 0) return '#666666'; // Grey for not started
    if (progress >= 100) return '#4CAF50'; // Green for completed
    return '#FF9800'; // Amber for in progress (even 1 verse)
  };

  const renderGreeting = () => {
    const name = userName?.trim();

    if (!name) {
      return 'Ahlan Wa Sahlan!';
    }

    return `Ahlan Wa Sahlan! Yaa, ${name}`;
  };

  // Calculate highest stats
  const highestStats = useMemo(() => {
    let maxMem = { count: 0, date: null as string | null };
    let maxRev = { count: 0, date: null as string | null };

    activityData.memorizedVerses.forEach((d) => {
      if (d.count > maxMem.count) {
        maxMem = { count: d.count, date: d.date };
      }
    });

    activityData.revisedVerses.forEach((d) => {
      if (d.count > maxRev.count) {
        maxRev = { count: d.count, date: d.date };
      }
    });

    return { memorized: maxMem, revised: maxRev };
  }, [activityData]);

  // Calculate Division Progress
  const divisionStats = useMemo(() => {
    // Collect all memorized surahs (surahs that have at least one memorized verse)
    const memorizedSurahs = new Set<number>();
    memorizedVerses.forEach(verseId => {
      let startVerseId = 0;
      for (let i = 1; i <= 114; i++) {
        const surah = surahsData.find(s => s.id === i);
        if (!surah) continue;
        if (verseId <= startVerseId + surah.versesCount) {
          memorizedSurahs.add(i);
          break;
        }
        startVerseId += surah.versesCount;
      }
    });

    return DIVISIONS.map(div => {
      const memCount = div.surahs.filter(s => memorizedSurahs.has(s)).length;
      const total = div.surahs.length;
      return {
        ...div,
        memorized: memCount,
        percentage: total > 0 ? (memCount / total) * 100 : 0
      };
    });
  }, [memorizedVerses]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: '#1a1a1a' }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text
          style={[
            styles.greeting,
            {
              color: colors.text,
              fontSize: userName && userName.length > 15 ? 20 : 24
            }
          ]}
          numberOfLines={2}
        >
          {renderGreeting()}
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.secondary }]}>
          Your memorization progress
        </Text>
      </View>

      {/* ── Global Ummah Stats (Community) ── shown when Remote Config flag is enabled */}
      {communityStatsEnabled && (
        <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Globe size={20} color="#D4AF37" style={{ marginRight: 8 }} />
            <Text style={[styles.title, { color: colors.text, fontSize: 18, marginBottom: 0 }]}>Global Ummah Stats</Text>
          </View>

          {communityStatsLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <ActivityIndicator color="#D4AF37" />
              <Text style={{ color: '#888', marginTop: 8, fontSize: 12 }}>Fetching community data…</Text>
            </View>
          ) : communityStats == null ? (
            <Text style={{ color: '#888', fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>
              Community data unavailable. Check your connection.
            </Text>
          ) : (
            <>
              {/* 3 global number tiles */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 }}>
                {[
                  {
                    label: 'Verses\nMemorized',
                    // FIX: read from the authoritative global counter, not a broken surah-doc sum
                    value: (() => {
                      const t = Math.max(0, communityStats.global?.total_verses_memorized ?? 0);
                      if (t >= 1_000_000) return `${(t / 1_000_000 % 1 === 0 ? t / 1_000_000 : (t / 1_000_000).toFixed(1))}M`;
                      if (t >= 1_000) return `${(t / 1_000 % 1 === 0 ? t / 1_000 : (t / 1_000).toFixed(1))}K`;
                      return String(t);
                    })(),
                    color: '#4CAF50',
                  },
                  {
                    label: 'Surahs\nMemorized',
                    value: (() => {
                      const t = Math.max(0, communityStats.global?.total_surahs_memorized ?? communityStats.global?.total_surahs_completed ?? 0);
                      if (t >= 1_000) return `${(t / 1_000 % 1 === 0 ? t / 1_000 : (t / 1_000).toFixed(1))}K`;
                      return String(t);
                    })(),
                    color: '#D4AF37',
                  },
                  {
                    label: 'Juz\nCompleted',
                    value: (() => {
                      const t = Math.max(0, communityStats.global?.total_juz_completed ?? 0);
                      if (t >= 1_000) return `${(t / 1_000 % 1 === 0 ? t / 1_000 : (t / 1_000).toFixed(1))}K`;
                      return String(t);
                    })(),
                    color: '#2196F3',
                  },
                  {
                    label: 'Favourites\nAdded',
                    value: (() => {
                      const t = Math.max(0, communityStats.global?.total_favourites ?? 0);
                      if (t >= 1_000_000) return `${(t / 1_000_000 % 1 === 0 ? t / 1_000_000 : (t / 1_000_000).toFixed(1))}M`;
                      if (t >= 1_000) return `${(t / 1_000 % 1 === 0 ? t / 1_000 : (t / 1_000).toFixed(1))}K`;
                      return String(t);
                    })(),
                    color: '#E91E63',
                  },
                ].map(tile => (
                  <View key={tile.label} style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 22, fontWeight: '700', color: tile.color, letterSpacing: 0.5 }}>{tile.value}</Text>
                    <Text style={{ fontSize: 9, color: '#888', marginTop: 3, textAlign: 'center', lineHeight: 13 }}>{tile.label}</Text>
                  </View>
                ))}
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: 'rgba(212,175,55,0.15)', marginBottom: 12 }} />

              {/* Top 3 most-memorized surahs */}
              {communityStats.surahs && (() => {
                const top3 = Array.from(communityStats.surahs.values())
                  .filter(s => (s.memorized_count ?? 0) >= minThreshold)
                  .sort((a, b) => (b.memorized_count ?? 0) - (a.memorized_count ?? 0))
                  .slice(0, 3);
                if (top3.length === 0) return null;
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <View>
                    <Text style={{ color: '#888', fontSize: 11, marginBottom: 8, fontWeight: '600', letterSpacing: 0.5 }}>TOP MEMORIZED SURAHS</Text>
                    {top3.map((s, i) => (
                      <View key={s.surah_number} style={{
                        flexDirection: 'row', alignItems: 'center',
                        paddingVertical: 6, borderBottomWidth: i < 2 ? 1 : 0,
                        borderBottomColor: 'rgba(255,255,255,0.06)',
                      }}>
                        <Text style={{ fontSize: 16, marginRight: 10 }}>{medals[i]}</Text>
                        <Text style={{ color: '#ddd', fontSize: 13, flex: 1, fontWeight: '500' }}>{s.surah_name}</Text>
                        <Text style={{ color: '#D4AF37', fontSize: 13, fontWeight: '700' }}>
                          {(s.memorized_count ?? 0) >= 1000
                            ? `${((s.memorized_count ?? 0) / 1000).toFixed(1)}K`
                            : s.memorized_count ?? 0}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })()}

              <TouchableOpacity
                onPress={() => router.push('/community-stats' as any)}
                style={{ marginTop: 14, paddingVertical: 8, alignItems: 'center',
                  borderRadius: 10, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)',
                  backgroundColor: 'rgba(212,175,55,0.06)' }}
              >
                <Text style={{ color: '#D4AF37', fontSize: 13, fontWeight: '600' }}>View Global Ummah Stats</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Progress Overview with Division Indicators */}
      <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <BookOpen size={20} color="#D4AF37" style={{ marginRight: 8 }} />
          <Text style={[styles.title, { color: colors.text, fontSize: 18, marginBottom: 0 }]}>
            Memorization Summary
          </Text>
        </View>

        <View style={styles.circularProgressContainer}>
          {divisionStats.map((div, index) => {
            const circleColors = ['#2196F3', '#FFD700', '#4CAF50', '#9C27B0'];
            return (
              <CircularProgress
                key={div.id}
                size={75}
                strokeWidth={5}
                progress={div.percentage}
                label={div.name}
                value={`${div.memorized}/${div.surahs.length}`}
                progressColor={circleColors[index % circleColors.length]}
                textColor="#ffffff"
                onInfoPress={() => setInfoDivision(div)}
              />
            );
          })}
        </View>
      </View>

      {/* Division Info Modal */}
      <Modal
        visible={infoDivision !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setInfoDivision(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setInfoDivision(null)}
        >
          <View style={[styles.modalContent, { backgroundColor: '#2a2a2a', borderColor: '#444' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFD700', fontSize: 22, fontWeight: 'bold', paddingRight: 10 }} adjustsFontSizeToFit numberOfLines={1}>
                  {infoDivision?.name} ({infoDivision?.arabic})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setInfoDivision(null)}>
                <X size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <View style={{ backgroundColor: 'rgba(33, 150, 243, 0.15)', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(33, 150, 243, 0.3)' }}>
              <Text style={{ color: '#64B5F6', fontSize: 14, fontWeight: 'bold', marginBottom: 4 }}>Surahs Included:</Text>
              <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '500' }}>{infoDivision?.range}</Text>
            </View>
            <Text style={{ color: '#E0E0E0', fontSize: 16, lineHeight: 24 }}>
              {infoDivision?.description}
            </Text>
          </View>
        </Pressable>
      </Modal>

      {/* Quranic Duas Progress Card */}
      <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.duaHeader}>
          <View style={styles.duaHeaderLeft}>
            <View style={styles.duaIconBadge}>
              <Sparkles size={20} color="#D4AF37" fill="rgba(212, 175, 55, 0.1)" />
            </View>
            <View>
              <Text style={[styles.title, { color: colors.text, fontSize: 18, marginBottom: 2 }]}>Quranic Duas</Text>
              <Text style={[styles.subtitle, { color: colors.secondary, fontSize: 13 }]}>Memorization status</Text>
            </View>
          </View>
        </View>

        <View style={styles.duaStatsRow}>
          <View style={styles.duaStat}>
            <Text style={[styles.duaStatValue, { color: '#4CAF50' }]}>
              {(() => {
                const DUAS = QURANIC_DUAS_DATA as QuranicDua[];
                const stats = calculateDuaStats(DUAS, memorizedVerses, revisedVerses);
                return stats.memorized;
              })()}
            </Text>
            <Text style={[styles.duaStatLabel, { color: colors.secondary }]}>Memorized</Text>
          </View>

          <View style={styles.duaStat}>
            <Text style={[styles.duaStatValue, { color: '#2196F3' }]}>
              {(() => {
                const DUAS = QURANIC_DUAS_DATA as QuranicDua[];
                const stats = calculateDuaStats(DUAS, memorizedVerses, revisedVerses);
                return stats.revised;
              })()}
            </Text>
            <Text style={[styles.duaStatLabel, { color: colors.secondary }]}>Revised</Text>
          </View>

          <View style={styles.duaStat}>
            <Text style={[styles.duaStatValue, { color: '#FF9800' }]}>
              {(() => {
                const DUAS = QURANIC_DUAS_DATA as QuranicDua[];
                const stats = calculateDuaStats(DUAS, memorizedVerses, revisedVerses);
                return stats.pending;
              })()}
            </Text>
            <Text style={[styles.duaStatLabel, { color: colors.secondary }]}>Pending</Text>
          </View>
        </View>

        <View style={[styles.duaProgressBar, { backgroundColor: colors.border }]}>
          <View
            style={[{
              height: '100%',
              borderRadius: 4,
              backgroundColor: '#4CAF50',
              width: `${(() => {
                const DUAS = QURANIC_DUAS_DATA as QuranicDua[];
                const stats = calculateDuaStats(DUAS, memorizedVerses, revisedVerses);
                return (stats.total > 0 ? (stats.memorized / stats.total) * 100 : 0);
              })()}%`
            }]}
          />
        </View>

        <Text style={[styles.duaProgressText, { color: colors.secondary }]}>
          {(() => {
            const DUAS = QURANIC_DUAS_DATA as QuranicDua[];
            const stats = calculateDuaStats(DUAS, memorizedVerses, revisedVerses);
            return `${stats.memorized} of ${stats.total} duas memorized`;
          })()}
        </Text>
      </View>

      {/* 114 Surahs and 30 Juz Grid */}
      <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <TrendingUp size={20} color="#D4AF37" style={{ marginRight: 8 }} />
          <Text style={[styles.title, { color: colors.text, marginBottom: 0 }]}>
            Overall Progress
          </Text>
        </View>

        <View style={styles.toggleContainer}>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                { backgroundColor: viewMode === 'surah' ? primary : 'transparent' }
              ]}
              onPress={() => setViewMode('surah')}
            >
              <Text style={[styles.toggleText, { color: '#ffffff' }]}>
                Surah
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                { backgroundColor: viewMode === 'juz' ? primary : 'transparent' }
              ]}
              onPress={() => setViewMode('juz')}
            >
              <Text style={[styles.toggleText, { color: '#ffffff' }]}>
                Juz
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Legend for grid colors: Idle (grey), In progress (amber), Completed (green) */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#666666' }]} /><Text style={styles.legendText}>Idle</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} /><Text style={styles.legendText}>In progress</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} /><Text style={styles.legendText}>Completed</Text></View>
        </View>

        {viewMode === 'surah' ? (
          <View style={styles.gridContainer}>
            {surahsData.map((surah) => {
              const surahProgress = calculateSurahProgress(surah.id);
              const backgroundColor = getProgressColor(surahProgress.progress);

              return (
                <TouchableOpacity
                  key={surah.id}
                  style={[styles.gridItem, { backgroundColor }]}
                  onPress={() => setSelectedItem({
                    type: 'surah',
                    id: surah.id,
                    name: surah.name,
                    versesCount: surah.versesCount,
                    memorizedCount: surahProgress.memorized
                  })}
                >
                  <Text style={[styles.gridItemText, { color: '#ffffff' }]}>{surah.id}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {Array.from({ length: 30 }, (_, index) => {
              const juzNumber = index + 1;
              const progress = calculateJuzProgress(juzNumber, memorizedVerses);
              const backgroundColor = getProgressColor(progress.progress);

              return (
                <TouchableOpacity
                  key={juzNumber}
                  style={[styles.gridItem, { backgroundColor }]}
                  onPress={() => setSelectedItem({
                    type: 'juz',
                    id: juzNumber,
                    name: `Juz ${juzNumber}`,
                    versesCount: progress.total,
                    memorizedCount: progress.memorized
                  })}
                >
                  <Text style={[styles.gridItemText, { color: '#ffffff' }]}>{juzNumber}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Progress Details Modal */}
      <Modal
        visible={selectedItem !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedItem(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedItem(null)}
        >
          <View style={[styles.modalContent, { backgroundColor: '#333333', borderColor: '#555555' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: '#ffffff' }]}>
                {selectedItem?.name}
              </Text>
              <TouchableOpacity onPress={() => setSelectedItem(null)}>
                <X size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <>
                <View style={styles.modalStats}>
                  <View style={styles.modalStatItem}>
                    <Text style={[styles.modalStatLabel, { color: '#ffffff' }]}>
                      Total Verses
                    </Text>
                    <Text style={[styles.modalStatValue, { color: '#ffffff' }]}>
                      {selectedItem.versesCount}
                    </Text>
                  </View>

                  <View style={styles.modalStatItem}>
                    <Text style={[styles.modalStatLabel, { color: '#ffffff' }]}>
                      Memorized
                    </Text>
                    <Text style={[styles.modalStatValue, { color: '#ffffff' }]}>
                      {selectedItem.memorizedCount}
                    </Text>
                  </View>

                  <View style={styles.modalStatItem}>
                    <Text style={[styles.modalStatLabel, { color: '#ffffff' }]}>
                      Progress
                    </Text>
                    <Text style={[styles.modalStatValue, { color: '#ffffff' }]}>
                      {Math.round((selectedItem.memorizedCount / selectedItem.versesCount) * 100)}%
                    </Text>
                  </View>
                </View>

                <View style={[styles.modalProgressBar, { backgroundColor: '#555555' }]}>
                  <View
                    style={[
                      styles.modalProgressFill,
                      {
                        width: `${(selectedItem.memorizedCount / selectedItem.versesCount) * 100}%`,
                        backgroundColor: getProgressColor((selectedItem.memorizedCount / selectedItem.versesCount) * 100)
                      }
                    ]}
                  />
                </View>

                {selectedItem.type === 'surah' && (
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: '#2196F3' }]}
                    onPress={() => {
                      setSelectedItem(null);
                      useQuranStore.getState().setLastViewedSurahId(selectedItem.id);
                      try {
                        router.replace({
                          pathname: '/(tabs)/read',
                          params: {
                            surahId: selectedItem.id.toString(),
                            source: 'stats'
                          }
                        });
                      } catch {
                        router.push({
                          pathname: '/(tabs)/read',
                          params: {
                            surahId: selectedItem.id.toString(),
                            source: 'stats'
                          }
                        });
                      }
                    }}
                  >
                    <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Open Surah</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Activity Bar Chart with Timeframe Selector */}
      {/* Activity Bar Chart with Timeframe Selector */}
      <ActivityBarChart data={activityData} pageData={pageActivityData} />

      {/* Time Series Graph - Google Play Console Style */}
      <ActivityTimeSeriesGraph data={activityData} pageData={pageActivityData} />

      {/* Tab Selector for Heatmap */}
      <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border, padding: 0, overflow: 'hidden' }]}>
        <View style={styles.heatmapTabSelector}>
          <TouchableOpacity
            style={[
              styles.heatmapTab,
              heatmapType === 'memorized' && { backgroundColor: primary }
            ]}
            onPress={() => setHeatmapType('memorized')}
          >
            <Text style={[
              styles.heatmapTabText,
              { color: heatmapType === 'memorized' ? '#ffffff' : '#666666' }
            ]}>
              Memorization
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.heatmapTab,
              heatmapType === 'revised' && { backgroundColor: primary }
            ]}
            onPress={() => setHeatmapType('revised')}
          >
            <Text style={[
              styles.heatmapTabText,
              { color: heatmapType === 'revised' ? '#ffffff' : '#666666' }
            ]}>
              Revision
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Heatmap Calendar */}
      <HeatmapCalendar data={activityData} type={heatmapType} />

      {/* Highest Daily Activity Card */}
      <HighestStatsCard
        highestMemorized={highestStats.memorized}
        highestRevised={highestStats.revised}
      />

      {/* Verse Activity Graph - Mobile pattern: positioned at bottom */}
      <VerseProgressCard />

      {/* Lifetime cumulative progress graph */}
      <LifetimeProgressCard />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 18,
    fontWeight: '400',
  },
  progressCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  progressTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  circularProgressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-start',
    paddingHorizontal: 0,
    gap: 4,
  },
  toggleContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    width: 160,
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  gridItem: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridItemText: {
    fontSize: 12,
    fontWeight: '600',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginBottom: 12,
    marginTop: 6,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  legendText: { color: '#cccccc', fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#333333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  modalStats: {
    marginBottom: 20,
  },
  modalStatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalStatLabel: {
    fontSize: 16,
    color: '#ffffff',
  },
  modalStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalProgressBar: {
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
    marginBottom: 20,
  },
  modalProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  modalButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  heatmapTabSelector: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    padding: 4,
    gap: 4,
  },
  heatmapTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  heatmapTabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  duaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  duaHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  duaIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  duaStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  duaStat: {
    alignItems: 'center',
  },
  duaStatValue: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  duaStatLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  duaProgressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  duaProgressText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94a3b8',
  },
});