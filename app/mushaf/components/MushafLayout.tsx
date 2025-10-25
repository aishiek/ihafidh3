import { TajweedService } from '@/app/mushaf/services/tajweedService';
import { PageLayout } from '@/types/layout';
import { TajweedConfig, TajweedRule, WordWithTajweed } from '@/types/tajweed';
import { BookOpen, Settings } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TajweedSettings } from '../../components/Settings/TajweedSettings';
import LayoutService from '../services/layoutService';
import { LayoutSelector } from './LayoutSelector';
import { TajweedRenderer } from './TajweedRenderer';

export const MushafLayout: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(604);
  const [pageLayout, setPageLayout] = useState<PageLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLayoutSelector, setShowLayoutSelector] = useState(false);
  const [showTajweedSettings, setShowTajweedSettings] = useState(false);
  
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
      loadPage(currentPage);
    }
  }, [currentPage, loading]);

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

      const total = await LayoutService.getTotalPages();
      setTotalPages(total || 0);

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
    } catch (error) {
      console.error('Error loading page:', error);
    }
  };

  const handleLayoutChange = async (layoutId: string) => {
    setLoading(true);
    const success = await LayoutService.setActiveLayout(layoutId);
    if (success) {
      const total = await LayoutService.getTotalPages();
      setTotalPages(total);
      setCurrentPage(1);
      await loadPage(1);
    }
    setLoading(false);
  };

  const handlePageChange = (direction: 'next' | 'prev') => {
    if (direction === 'next' && currentPage < totalPages) setCurrentPage(currentPage + 1);
    else if (direction === 'prev' && currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const renderLine = (line: PageLayout, index: number) => {
    switch (line.line_type) {
      case 'surah_name':
        return (
          <View key={`line-${index}`} style={styles.surahNameContainer}>
            <Text style={styles.surahName}>سورة</Text>
          </View>
        );

      case 'basmallah':
        return (
          <View key={`line-${index}`} style={styles.basmallahContainer}>
            <Text style={styles.basmallah}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
          </View>
        );

      case 'ayah':
        if (line.first_word_id && line.last_word_id) {
          return <AyahLine key={`line-${index}`} line={line} config={tajweedConfig} />;
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowLayoutSelector(true)} style={styles.headerButton}>
          <BookOpen size={20} color="#3b82f6" />
          <Text style={styles.headerButtonText}>Layout</Text>
        </TouchableOpacity>

        <Text style={styles.pageNumber}>Page {currentPage} / {totalPages}</Text>

        <TouchableOpacity onPress={() => setShowTajweedSettings(true)} style={styles.headerButton}>
          <Settings size={20} color="#3b82f6" />
          <Text style={styles.headerButtonText}>Tajweed</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.pageContent}>
        <View style={styles.page}>{pageLayout.map((line, index) => renderLine(line, index))}</View>
      </ScrollView>

      <View style={styles.navigation}>
        <TouchableOpacity onPress={() => handlePageChange('prev')} disabled={currentPage === 1} style={[styles.navButton, currentPage === 1 && styles.navButtonDisabled]}>
          <Text style={styles.navButtonText}>← Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handlePageChange('next')} disabled={currentPage === totalPages} style={[styles.navButton, currentPage === totalPages && styles.navButtonDisabled]}>
          <Text style={styles.navButtonText}>Next →</Text>
        </TouchableOpacity>
      </View>

      <LayoutSelector visible={showLayoutSelector} onClose={() => setShowLayoutSelector(false)} onLayoutSelected={handleLayoutChange} />

      <TajweedSettings config={tajweedConfig} onConfigChange={setTajweedConfig} visible={showTajweedSettings} onClose={() => setShowTajweedSettings(false)} />
    </View>
  );
};

// AyahLine component (renders tajweed words for a line)
const AyahLine: React.FC<{ line: PageLayout; config: TajweedConfig }> = ({ line, config }) => {
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

  return <TajweedRenderer words={words} config={config} isCentered={line.is_centered} onWordPress={(w) => console.log('word', w)} />;
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
  basmallahContainer: { paddingVertical: 16, alignItems: 'center' },
  basmallah: { fontSize: 24, color: '#374151', textAlign: 'center' },
  separator: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 12 },
  lineLoading: { paddingVertical: 12, alignItems: 'center' },
  navigation: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  navButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#3b82f6' },
  navButtonDisabled: { backgroundColor: '#d1d5db' },
  navButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
