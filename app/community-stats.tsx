/**
 * Community Stats Screen — Redesigned
 * - Vertical Surah cards (not cluttered rows)
 * - Top 10 Juz displayed as ranked cards with bars
 * - Empty-state zero data shows "No data yet" with helpful copy
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, BookOpen, Globe, Heart, Star, Bookmark, Award, Brain, PenTool, TrendingUp, Volume2 } from 'lucide-react-native';
import { useCustomColors } from '@/utils/themeUtils';
import { useCommunityStatsFlag } from '@/utils/communityStatsFlag';
import {
  fetchAllStats,
  CommunityStatsData,
  SurahStat,
  JuzStat,
  BadgeStat,
} from '@/services/communityStatsService';

const { width: SCREEN_W } = Dimensions.get('window');

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Stat Tile (global summary) ─────────────────────────────────────────────
interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bg: string;
}
const StatTile: React.FC<StatTileProps> = ({ icon, label, value, color, bg }) => (
  <View style={[statTileStyles.wrap, { backgroundColor: bg }]}>
    <View style={[statTileStyles.iconWrap, { backgroundColor: color + '22' }]}>{icon}</View>
    <Text style={[statTileStyles.value, { color }]}>{value}</Text>
    <Text style={statTileStyles.label}>{label}</Text>
  </View>
);
const statTileStyles = StyleSheet.create({
  wrap:     { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 6 },
  iconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  value:    { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  label:    { fontSize: 10, color: '#888', fontWeight: '500', textAlign: 'center', lineHeight: 14 },
});

// ─── Surah Vertical Card ─────────────────────────────────────────────────────
const MEDAL = ['🥇', '🥈', '🥉'];
interface SurahCardProps {
  rank: number;
  stat: SurahStat;
  metric: 'memorized_count' | 'favourite_count' | 'completed_count' | 'bookmark_count' | 'revised_count';
  max: number;
  accent: string;
  bg: string;
  textColor: string;
}
const SurahCard: React.FC<SurahCardProps> = ({ rank, stat, metric, max, accent, bg, textColor }) => {
  const value = stat[metric] ?? 0;
  const frac  = max > 0 ? value / max : 0;
  const medal = rank <= 3 ? MEDAL[rank - 1] : null;
  return (
    <View style={[surahCardStyles.card, { backgroundColor: bg }]}>
      <View style={surahCardStyles.cardTop}>
        <View style={[surahCardStyles.rankBadge, { backgroundColor: rank <= 3 ? accent + '28' : '#33333388' }]}>
          {medal
            ? <Text style={{ fontSize: 16 }}>{medal}</Text>
            : <Text style={[surahCardStyles.rankNum, { color: accent }]}>#{rank}</Text>}
        </View>
        <View style={surahCardStyles.nameWrap}>
          <Text style={[surahCardStyles.name, { color: textColor }]} numberOfLines={1}>
            {stat.surah_name}
          </Text>
          <Text style={surahCardStyles.number}>Surah {stat.surah_number}</Text>
        </View>
        <Text style={[surahCardStyles.count, { color: accent }]}>{formatCount(value)}</Text>
      </View>
      <View style={surahCardStyles.barTrack}>
        <View style={[surahCardStyles.barFill, { width: `${Math.max(frac * 100, value > 0 ? 4 : 0)}%`, backgroundColor: accent }]} />
      </View>
    </View>
  );
};
const surahCardStyles = StyleSheet.create({
  card:     { marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 14, paddingBottom: 12 },
  cardTop:  { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  rankBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rankNum:  { fontSize: 13, fontWeight: '800' },
  nameWrap: { flex: 1 },
  name:     { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  number:   { fontSize: 11, color: '#888' },
  count:    { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  barTrack: { height: 5, borderRadius: 3, backgroundColor: '#ffffff18', overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: 3 },
});

// ─── Juz Card (top-10) ───────────────────────────────────────────────────────
interface JuzCardProps {
  rank: number;
  juz: JuzStat;
  max: number;
  isTop: boolean;
  bg: string;
  textColor: string;
}
const JuzCard: React.FC<JuzCardProps> = ({ rank, juz, max, isTop, bg, textColor }) => {
  const count = juz.completed_count ?? 0;
  const frac  = max > 0 ? count / max : 0;
  const GOLD  = '#D4AF37';
  const accent = isTop ? GOLD : '#a78bfa';
  return (
    <View style={[juzCardStyles.card, { backgroundColor: bg }, isTop && { borderColor: GOLD + '66', borderWidth: 1 }]}>
      <View style={juzCardStyles.row}>
        <View style={[juzCardStyles.rankDot, { backgroundColor: accent + '33' }]}>
          <Text style={[juzCardStyles.rankText, { color: accent }]}>{rank}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[juzCardStyles.juzLabel, { color: textColor }]}>
            Juz {juz.juz_number} {isTop && '🏆'}
          </Text>
          <View style={[juzCardStyles.barTrack, { backgroundColor: '#55555544' }]}>
            <View style={[juzCardStyles.barFill, { width: `${Math.max(frac * 100, count > 0 ? 4 : 0)}%`, backgroundColor: accent }]} />
          </View>
        </View>
        <Text style={[juzCardStyles.count, { color: accent }]}>
          {formatCount(count || 0)}
        </Text>
      </View>
    </View>
  );
};
const juzCardStyles = StyleSheet.create({
  card:     { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankDot:  { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 12, fontWeight: '800' },
  juzLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  barTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: 3 },
  count:    { fontSize: 14, fontWeight: '700', minWidth: 38, textAlign: 'right' },
});

// ─── Badge metadata (mirrors badgeStore.ts initialBadges) ───────────────────
const BADGE_META: { id: string; icon: string; name: string; arabicName: string; requirement: number; color: string }[] = [
  { id: 'awwal-noor',        icon: '🌟', name: 'First Light',               arabicName: 'أول النور',        requirement: 1,  color: '#FFD700' },
  { id: 'munir-al-darb',     icon: '🕌', name: 'Munir al-Darb',             arabicName: 'منير الدرب',       requirement: 3,  color: '#65C3BA' },
  { id: 'hamil-hikmah',      icon: '📖', name: 'Bearer of Wisdom',          arabicName: 'حامل الحكمة',      requirement: 5,  color: '#C0C0C0' },
  { id: 'sahib-istiqaamah',  icon: '🌙', name: 'Sahib al-Istiqamah',        arabicName: 'صاحب الاستقامة',   requirement: 10, color: '#8EC5FC' },
  { id: 'saari-sabeelillah', icon: '🛤️', name: "Traveller in Allah's Path", arabicName: 'ساري في سبيل الله', requirement: 15, color: '#CD7F32' },
  { id: 'sahib-azm',         icon: '🏔️', name: 'Sahib al-Azm',             arabicName: 'صاحب العزم',       requirement: 20, color: '#9B8AFB' },
  { id: 'naasir-quran',      icon: '🛡️', name: 'Defender of the Quran',    arabicName: 'ناصر القرآن',      requirement: 23, color: '#FF6347' },
  { id: 'rahiq-yaqeen',      icon: '📖✨',name: 'Rahiq Al-Yaqeen',          arabicName: 'رحيق اليقين',      requirement: 25, color: '#F6AE2D' },
  { id: 'hafidh-quran',      icon: '👑', name: 'Hafidh Al-Quran',           arabicName: 'حافظ القرآن',      requirement: 30, color: '#4169E1' },
];

// ─── Badge Card ──────────────────────────────────────────────────────────────
interface BadgeCardProps {
  meta: typeof BADGE_META[number];
  count: number;
  bg: string;
  textColor: string;
}
const BadgeCard: React.FC<BadgeCardProps> = ({ meta, count, bg, textColor }) => (
  <View style={[badgeCardStyles.card, { backgroundColor: bg, borderColor: meta.color + '44', borderWidth: count > 0 ? 1 : 0 }]}>
    <View style={[badgeCardStyles.iconWrap, { backgroundColor: meta.color + '22' }]}>
      <Text style={badgeCardStyles.icon}>{meta.icon}</Text>
    </View>
    <View style={badgeCardStyles.info}>
      <Text style={[badgeCardStyles.name, { color: textColor }]} numberOfLines={1}>{meta.name}</Text>
      <Text style={badgeCardStyles.arabic} numberOfLines={1}>{meta.arabicName}</Text>
      <Text style={[badgeCardStyles.req, { color: '#666' }]}>Requires {meta.requirement} Juz</Text>
    </View>
    <View style={[badgeCardStyles.countWrap, { backgroundColor: count > 0 ? meta.color + '22' : '#33333344' }]}>
      <Text style={[badgeCardStyles.count, { color: count > 0 ? meta.color : '#555' }]}>
        {formatCount(count || 0)}
      </Text>
      <Text style={badgeCardStyles.countLabel}>earned</Text>
    </View>
  </View>
);
const badgeCardStyles = StyleSheet.create({
  card:       { marginHorizontal: 16, marginBottom: 8, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap:   { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  icon:       { fontSize: 22 },
  info:       { flex: 1, gap: 2 },
  name:       { fontSize: 13, fontWeight: '700' },
  arabic:     { fontSize: 12, color: '#888', fontFamily: 'System' },
  req:        { fontSize: 10, marginTop: 2 },
  countWrap:  { alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minWidth: 52 },
  count:      { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  countLabel: { fontSize: 9, color: '#777', marginTop: 1 },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function CommunityStatsScreen() {
  const colors   = useCustomColors();
  const { enabled, minThreshold, loading: flagLoading } = useCommunityStatsFlag();
  const [stats,      setStats]      = useState<CommunityStatsData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [activeTab,  setActiveTab]  = useState<'memorized' | 'completed' | 'favourites' | 'bookmarks' | 'revised'>('memorized');

  type ActiveTab = 'memorized' | 'completed' | 'favourites' | 'bookmarks' | 'revised';
  const TAB_CONFIG: { key: ActiveTab; label: string; metric: 'memorized_count' | 'favourite_count' | 'completed_count' | 'bookmark_count' | 'revised_count'; limit: number }[] = [
    { key: 'memorized',  label: 'Memorized',  metric: 'memorized_count',  limit: 10 },
    { key: 'completed',  label: 'Completed',  metric: 'completed_count',  limit: 10 },
    { key: 'revised',    label: 'Revised',    metric: 'revised_count',    limit: 10 },
    { key: 'favourites', label: 'Favourites', metric: 'favourite_count',  limit: 5  },
    { key: 'bookmarks',  label: 'Bookmarks',  metric: 'bookmark_count',   limit: 5  },
  ];
  const currentTabCfg = TAB_CONFIG.find(t => t.key === activeTab)!;

  const loadStats = useCallback(async (force = false) => {
    setError(null);
    try {
      const data = await fetchAllStats(force);
      setStats(data);
    } catch (e) {
      setError('Could not load Global Ummah Stats. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!flagLoading && enabled) {
      loadStats();
    } else if (!flagLoading) {
      setLoading(false);
    }
  }, [flagLoading, enabled, loadStats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStats(true);
  }, [loadStats]);

  const GOLD    = '#D4AF37';
  const isDark  = colors.background === '#000000' || colors.background.startsWith('#1') || colors.background.startsWith('#0');
  const cardBg  = isDark ? '#1a1a1a' : '#f0f0f0';
  const headerBg = isDark ? '#111' : '#1a1a2e';

  // Top surahs for active tab
  const topSurahs = useMemo(() => {
    if (!stats) return [];
    return Array.from(stats.surahs.values())
      .filter(s => (s[currentTabCfg.metric] ?? 0) > 0 && (s[currentTabCfg.metric] ?? 0) >= minThreshold)
      .sort((a, b) => (b[currentTabCfg.metric] ?? 0) - (a[currentTabCfg.metric] ?? 0))
      .slice(0, currentTabCfg.limit);
  }, [stats, currentTabCfg, minThreshold]);

  const maxSurahCount = useMemo(() =>
    topSurahs.reduce((m, s) => Math.max(m, s[currentTabCfg.metric] ?? 0), 0),
    [topSurahs, currentTabCfg]
  );

  // Top 10 Juz by completed_count (> 0 only)
  const top10Juz = useMemo(() => {
    if (!stats?.juz) return [];
    return Array.from(stats.juz.values())
      .filter(j => (j.completed_count ?? 0) > 0)
      .sort((a, b) => (b.completed_count ?? 0) - (a.completed_count ?? 0))
      .slice(0, 10);
  }, [stats]);

  const maxJuzCount = useMemo(() =>
    top10Juz.reduce((m, j) => Math.max(m, j.completed_count ?? 0), 0),
    [top10Juz]
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (flagLoading || loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: headerBg }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Global Ummah Stats</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={GOLD} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading community data...</Text>
        </View>
      </View>
    );
  }

  if (!enabled) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: headerBg }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Global Ummah Stats</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Globe size={56} color={GOLD} style={{ marginBottom: 16 }} />
          <Text style={[styles.comingSoonTitle, { color: colors.text }]}>Coming Soon</Text>
          <Text style={[styles.comingSoonText, { color: '#888' }]}>
            Global Ummah Stats will show anonymous global insights once enough data has been collected.
          </Text>
        </View>
      </View>
    );
  }

  if (error || !stats) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: headerBg }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Global Ummah Stats</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: '#cc4444' }]}>{error || 'No data available'}</Text>
          <TouchableOpacity onPress={() => loadStats(true)} style={[styles.retryButton, { borderColor: GOLD }]}>
            <Text style={[styles.retryText, { color: GOLD }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const { global: g } = stats;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBg }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Global Ummah Stats</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Anonymous notice */}
        <View style={[styles.anonBanner, { backgroundColor: GOLD + '18', borderColor: GOLD + '44', gap: 8 }]}>
          <Globe size={14} color={GOLD} style={{ marginTop: 2 }} />
          <Text style={[styles.anonText, { color: GOLD }]}>
            All stats are anonymous and aggregate only. No user data is collected.
          </Text>
        </View>

        {/* ── Global Summary: 2-column tiles ─────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Global Milestones</Text>
        <View style={styles.tilesRow}>
          <StatTile icon={<BookOpen size={18} color={GOLD} />}       label="Surahs Completed"    value={formatCount(g.total_surahs_completed)}      color={GOLD}      bg={cardBg} />
          <StatTile icon={<Star size={18} color="#a78bfa" />}        label="Juz Completed"        value={formatCount(g.total_juz_completed)}          color="#a78bfa"   bg={cardBg} />
        </View>
        <View style={styles.tilesRow}>
          <StatTile icon={<Heart size={18} color="#f87171" />}       label="Verses Favourited"    value={formatCount(g.total_favourites)}             color="#f87171"   bg={cardBg} />
          <StatTile icon={<Bookmark size={18} color="#60a5fa" />}    label="Verses Bookmarked"    value={formatCount(g.total_bookmarks)}              color="#60a5fa"   bg={cardBg} />
        </View>
        <View style={styles.tilesRow}>
          <StatTile icon={<Volume2 size={18} color="#fbbf24" />}     label="Audio Played"        value={formatCount((g as any).total_audio_played || 0)} color="#fbbf24"   bg={cardBg} />
          <StatTile icon={<Brain size={18} color="#10b981" />}       label="AI Quizzes Taken"     value={formatCount(g.total_quizzes_ai || 0)}        color="#10b981"   bg={cardBg} />
        </View>
        <View style={styles.tilesRow}>
          <StatTile icon={<PenTool size={18} color="#3b82f6" />}     label="Manual Quizzes Taken" value={formatCount(g.total_quizzes_manual || 0)}    color="#3b82f6"   bg={cardBg} />
          <View style={{ flex: 1 }} />
        </View>

        {/* ── Top Surahs — tab-filtered vertical cards ─────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Surahs</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabScroll}
          contentContainerStyle={styles.tabScrollContent}
        >
          {TAB_CONFIG.map(tab => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tab,
                activeTab === tab.key && { backgroundColor: GOLD + '22', borderColor: GOLD },
              ]}
            >
              <Text style={[styles.tabText, { color: activeTab === tab.key ? GOLD : '#888' }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {topSurahs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <TrendingUp size={36} color="#444" style={{ marginBottom: 10 }} />
            <Text style={[styles.emptyTitle, { color: '#666' }]}>No data yet</Text>
            <Text style={[styles.emptyText, { color: '#555' }]}>
              Counts will appear once the community starts contributing. Keep memorizing!
            </Text>
          </View>
        ) : (
          topSurahs.map((s, idx) => (
            <SurahCard
              key={s.surah_number}
              rank={idx + 1}
              stat={s}
              metric={currentTabCfg.metric}
              max={maxSurahCount}
              accent={GOLD}
              bg={cardBg}
              textColor={colors.text}
            />
          ))
        )}

        {/* ── Top 10 Juz — ranked cards ─────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Juz (Completed)</Text>

        {top10Juz.length === 0 ? (
          <View style={styles.emptyContainer}>
            <TrendingUp size={36} color="#444" style={{ marginBottom: 10 }} />
            <Text style={[styles.emptyTitle, { color: '#666' }]}>No Juz data yet</Text>
            <Text style={[styles.emptyText, { color: '#555' }]}>
              Complete a Juz to see it appear here!
            </Text>
          </View>
        ) : (
          top10Juz.map((juz, idx) => (
            <JuzCard
              key={juz.juz_number}
              rank={idx + 1}
              juz={juz}
              max={maxJuzCount}
              isTop={idx === 0 && maxJuzCount > 0}
              bg={cardBg}
              textColor={colors.text}
            />
          ))
        )}

        {/* ── Community Badges ──────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Community Badges Earned</Text>
        {BADGE_META.map((meta) => {
          const stat = stats.badges?.get(meta.id);
          const count = stat?.unlock_count ?? 0;
          return (
            <BadgeCard
              key={meta.id}
              meta={meta}
              count={count}
              bg={cardBg}
              textColor={colors.text}
            />
          );
        })}

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: '#555' }]}>
            Pull down to refresh · Data updates in real-time
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backButton: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 0.4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { marginTop: 12, fontSize: 14, opacity: 0.7 },
  comingSoonTitle: { fontSize: 22, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  comingSoonText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  errorText: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10, marginTop: 8 },
  retryText: { fontWeight: '600', fontSize: 14 },
  scrollContent: { paddingBottom: 48 },
  anonBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginHorizontal: 16, marginTop: 16, marginBottom: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 8, borderWidth: 1,
  },
  anonText: { fontSize: 12, flex: 1, lineHeight: 18 },
  sectionTitle: {
    fontSize: 11, fontWeight: '800',
    marginTop: 24, marginBottom: 12,
    marginHorizontal: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    opacity: 0.55,
  },
  tilesRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 10 },
  // Tabs — horizontal scroll
  tabScroll: { marginHorizontal: 16, marginBottom: 14 },
  tabScrollContent: { gap: 8, paddingRight: 8 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#44444466',
  },
  tabText: { fontSize: 13, fontWeight: '600' },
  // Empty state
  emptyContainer: { padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  footer: { paddingTop: 24, paddingBottom: 8, alignItems: 'center' },
  footerText: { fontSize: 11 },
});
