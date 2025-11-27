import { TajweedService } from '@/app/mushaf/services/tajweedService';
import { PageLayout } from '@/types/layout';
import { TajweedConfig, TajweedRule, WordWithTajweed } from '@/types/tajweed';
import * as Haptics from 'expo-haptics';
import { BookOpen, Settings } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { TajweedSettings } from '../../components/Settings/TajweedSettings';
import LayoutService from '../services/layoutService';
import { TajweedRenderer } from './TajweedRenderer';

import { surahsData } from '@/data/surahs';
import { useThemeStore } from '@/store/themeStore';
import type { Surah } from '@/types';

interface MushafLayoutProps {
  pageNumber: number;
  onPageChange: (page: number) => void;
  totalPages?: number;
}

export const MushafLayout: React.FC<MushafLayoutProps> = ({ pageNumber, onPageChange, totalPages = 604 }) => {
  const [pageLayout, setPageLayout] = useState<PageLayout[]>([]);
  const [loading, setLoading] = useState(true);
  // Header surah (computed when the layout page doesn't include an explicit surah_name)
  const [pageHeaderSurah, setPageHeaderSurah] = useState<Surah | null>(null);
  const [showTajweedSettings, setShowTajweedSettings] = useState(false);

  const { themeMode } = useThemeStore();
  const isDark = themeMode === 'dark';
  const textColor = isDark ? '#ffffff' : '#000000';
  const backgroundColor = isDark ? '#000000' : '#ffffff';

  const [tajweedConfig, setTajweedConfig] = useState<TajweedConfig>({
    enabled: true,
    highlightedRules: Object.values(TajweedRule),
    showLabels: false,
    opacity: 0.4,
  });

  useEffect(() => {
    initializeServices();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadPage(pageNumber);
    }
  }, [pageNumber, loading]);

  // Recompute header when the page layout has changed
  useEffect(() => {
    computePageHeader(pageNumber, pageLayout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageLayout, pageNumber]);

  const initializeServices = async () => {
    try {
      setLoading(true);
      const layoutSuccess = await LayoutService.initializeDefaultLayout();
      if (!layoutSuccess) {
        console.error('Failed to initialize layout');
        setLoading(false);
        return;
      }

      // initialize tajweed
      await TajweedService.initialize();

      setLoading(false);
    } catch (error) {
      console.error('Error initializing services:', error);
      setLoading(false);
    }
  };

  const loadPage = async (pageNum: number) => {
    try {
      const layout = await LayoutService.getPageLayout(pageNum);
      setPageLayout(layout);
      // compute header for fresh layout
      await computePageHeader(pageNum, layout);
    } catch (error) {
      console.error('Error loading page:', error);
    }
  };

  /**
   * Compute the surah name header for a page when there isn't an explicit surah_name
   * line. Strategy:
   *  - Prefer any explicit surah_name on the layout page
   *  - Fall back to the first ayah line's surah_number
   *  - Final fallback: ask LayoutService.getSurahForPage(pageNumber) which queries the DB
   */
  const computePageHeader = async (pageNum: number, layout?: PageLayout[]) => {
    try {
      const lines = layout ?? pageLayout;
      if (!lines || lines.length === 0) {
        setPageHeaderSurah(null);
        return;
      }

      // 1) explicit surah_name line
      const explicit = lines.find((l) => l.line_type === 'surah_name' && typeof l.surah_number === 'number');
      let surahId = explicit?.surah_number ?? null;

      // 2) first ayah line's surah_number
      if (!surahId) {
        const firstAyah = lines.find((l) => l.line_type === 'ayah' && typeof l.surah_number === 'number');
        surahId = firstAyah?.surah_number ?? null;
      }

      // 3) query DB as final fallback
      if (!surahId) {
        const res = await LayoutService.getSurahForPage(pageNum);
        surahId = res?.surah_number ?? null;
      }

      if (surahId) {
        const found = surahsData.find((s) => s.id === surahId) ?? null;
        setPageHeaderSurah(found);
      } else {
        setPageHeaderSurah(null);
      }
    } catch (err) {
      console.warn('[computePageHeader] failed', err);
      setPageHeaderSurah(null);
    }
  };

  const handleLayoutChange = async (layoutId: string) => {
    setLoading(true);
    const success = await LayoutService.setActiveLayout(layoutId);
    if (success) {
      await loadPage(1);
    }
    setLoading(false);
  };

  const handlePageChange = (direction: 'next' | 'prev') => {
    if (direction === 'next' && pageNumber < totalPages) onPageChange(pageNumber + 1);
    else if (direction === 'prev' && pageNumber > 1) onPageChange(pageNumber - 1);
  };

  // Swipe detection: horizontal swipes change pages while vertical scroll keeps working.
  // We debounce swipes (brief lock) to avoid multiple rapid changes.
  const swipeLockRef = useRef(false);
  const SWIPE_THRESHOLD = 80; // px translation
  const VELOCITY_THRESHOLD = 500; // px/s

  const onPanHandlerStateChange = ({ nativeEvent }: any) => {
    // Only handle when the gesture ends
    if (nativeEvent.state !== State.END) return;

    // Ignore if we're locked (recent swipe) or still loading
    if (swipeLockRef.current || loading) return;

    const x = nativeEvent.translationX || 0;
    const y = nativeEvent.translationY || 0;
    const vX = nativeEvent.velocityX || 0;

    // If vertical travel dominates, ignore to avoid interfering with vertical scrolling
    if (Math.abs(y) > Math.abs(x) && Math.abs(y) > 40) return;

    // Swipe left (next page)
    if ((x < -SWIPE_THRESHOLD) || (vX < -VELOCITY_THRESHOLD)) {
      swipeLockRef.current = true;
      handlePageChange('next');
      // light haptic on forward swipe
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { }); } catch (_) { }
      setTimeout(() => { swipeLockRef.current = false; }, 260);
      return;
    }

    // Swipe right (previous page)
    if ((x > SWIPE_THRESHOLD) || (vX > VELOCITY_THRESHOLD)) {
      swipeLockRef.current = true;
      handlePageChange('prev');
      // light haptic on backward swipe
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { }); } catch (_) { }
      setTimeout(() => { swipeLockRef.current = false; }, 260);
      return;
    }
  };

  const renderLine = (line: PageLayout, index: number) => {
    switch (line.line_type) {
      case 'surah_name': {
        // Render actual surah name if available on the layout line, otherwise use computed header
        const lineSurahId = typeof line.surah_number === 'number' ? line.surah_number : null;
        const lineSurah = lineSurahId ? surahsData.find(s => s.id === lineSurahId) : null;
        const surahToShow = lineSurah ?? pageHeaderSurah;
        const arabic = surahToShow?.arabicName ?? 'سورة';
        const english = surahToShow?.englishName ?? null;
        return (
          <View key={`line-${index}`} style={styles.surahNameContainer}>
            <Text style={[styles.surahName, { color: textColor }]}>{arabic}</Text>
            {english ? <Text style={[styles.surahEnglish, { color: isDark ? '#d1d5db' : '#374151' }]}>{english}</Text> : null}
          </View>
        );
      }

      case 'basmallah':
        return (
          <View key={`line-${index}`} style={styles.basmallahContainer}>
            <Text style={[styles.basmallah, { color: textColor }]}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
          </View>
        );

      case 'ayah':
        if (line.first_word_id && line.last_word_id) {
          return <AyahLine key={`line-${index}`} line={line} config={tajweedConfig} textColor={textColor} />;
        }
        return null;

      case 'separator':
        return <View key={`line-${index}`} style={styles.separator} />;

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading Mushaf...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { backgroundColor: isDark ? '#111' : '#f9fafb', borderColor: isDark ? '#333' : '#e5e7eb' }]}>
        <TouchableOpacity onPress={() => console.warn('Navigate to settings for layout change')} style={[styles.headerButton, { backgroundColor: isDark ? '#222' : '#eff6ff' }]}>
          <BookOpen size={20} color="#3b82f6" />
          <Text style={styles.headerButtonText}>Layout</Text>
        </TouchableOpacity>

        <Text style={[styles.pageNumber, { color: textColor }]}>Page {pageNumber} / {totalPages}</Text>

        <TouchableOpacity onPress={() => setShowTajweedSettings(true)} style={[styles.headerButton, { backgroundColor: isDark ? '#222' : '#eff6ff' }]}>
          <Settings size={20} color="#3b82f6" />
          <Text style={styles.headerButtonText}>Tajweed</Text>
        </TouchableOpacity>
      </View>

      <PanGestureHandler onHandlerStateChange={onPanHandlerStateChange} activeOffsetX={[-10, 10]} failOffsetY={[-10, 10]}>
        <ScrollView style={styles.pageContent}>
          <View style={styles.page}>
            {/* If the layout doesn't include an explicit surah_name line, render the computed header */}
            {!pageLayout.some(l => l.line_type === 'surah_name') && pageHeaderSurah ? (
              <View style={styles.surahNameContainer}>
                <Text style={[styles.surahName, { color: textColor }]}>{pageHeaderSurah.arabicName}</Text>
                {pageHeaderSurah.englishName ? (
                  <Text style={[styles.surahEnglish, { color: isDark ? '#d1d5db' : '#374151' }]}>{pageHeaderSurah.englishName}</Text>
                ) : null}
              </View>
            ) : null}
            {pageLayout.map((line, index) => renderLine(line, index))}
          </View>
        </ScrollView>
      </PanGestureHandler>

      <View style={styles.navigation}>
        <TouchableOpacity onPress={() => handlePageChange('prev')} disabled={pageNumber === 1} style={[styles.navButton, pageNumber === 1 && styles.navButtonDisabled]}>
          <Text style={styles.navButtonText}>← Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handlePageChange('next')} disabled={pageNumber === totalPages} style={[styles.navButton, pageNumber === totalPages && styles.navButtonDisabled]}>
          <Text style={styles.navButtonText}>Next →</Text>
        </TouchableOpacity>
      </View>

      <TajweedSettings config={tajweedConfig} onConfigChange={setTajweedConfig} visible={showTajweedSettings} onClose={() => setShowTajweedSettings(false)} />
    </View>
  );
};

// AyahLine component (renders tajweed words for a line)
const AyahLine: React.FC<{ line: PageLayout; config: TajweedConfig; textColor: string }> = ({ line, config, textColor }) => {
  const [words, setWords] = useState<WordWithTajweed[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadWords(); }, [line.first_word_id, line.last_word_id]);

  const loadWords = async () => {
    if (!line.first_word_id || !line.last_word_id) return;
    try {
      const wordsData = await TajweedService.getWordsInRangeTajweed(line.first_word_id, line.last_word_id);
      setWords(wordsData);
    } catch (error) {
      console.error('Error loading words:', error);
    } finally { setLoading(false); }
  };

  if (loading) return <View style={styles.lineLoading}><ActivityIndicator size="small" color="#d1d5db" /></View>;

  return <TajweedRenderer words={words} config={config} isCentered={line.is_centered} onWordPress={(w) => console.log('word', w)} textColor={textColor} />;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6b7280' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  headerButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#eff6ff' },
  headerButtonText: { fontSize: 14, fontWeight: '500', color: '#3b82f6' },
  pageNumber: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  pageContent: { flex: 1 },
  page: { padding: 16, minHeight: '100%' },
  surahNameContainer: { paddingVertical: 20, alignItems: 'center' },
  surahName: { fontSize: 28, fontWeight: 'bold', color: '#1f2937', textAlign: 'center' },
  surahEnglish: { fontSize: 14, marginTop: 6, color: '#6b7280', textAlign: 'center' },
  basmallahContainer: { paddingVertical: 16, alignItems: 'center' },
  basmallah: { fontSize: 24, color: '#374151', textAlign: 'center' },
  separator: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 12 },
  lineLoading: { paddingVertical: 12, alignItems: 'center' },
  navigation: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  navButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#3b82f6' },
  navButtonDisabled: { backgroundColor: '#d1d5db' },
  navButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});

export default MushafLayout;
