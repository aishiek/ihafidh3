import { useThemeStore } from '@/store/themeStore';
import { useCustomColors } from '@/utils/themeUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Heart } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { BackHandler, Modal, Platform, SafeAreaView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MushafFooter from '../components/MushafFooter';
import MushafHeader from '../components/MushafHeader';
import MushafPage from '../components/MushafPage';
import SurahList from '../components/SurahList';
import { useMushafBookmarks } from '../hooks/useMushafBookmarks';
import { PageMetadata, getPageMetadata, initMushafDB } from '../services/mushafMetadataService';
import { getAllSurahs, isMushafDatabaseReady } from '../services/mushafSurahService';

// ...existing imports...

const TOTAL_PAGES = 610;

export default function MushafViewerScreen() {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (Platform.OS === 'android') {
      const onBackPress = () => {
        handleClose();
        return true; // prevent default
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }
  }, []);
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Safely parse page number
  // Always use the latest pageNumber from params, fallback to last read only if param is missing
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    const pageNum = Number(params?.pageNumber);
    if (!isNaN(pageNum) && pageNum > 0 && pageNum <= TOTAL_PAGES) {
      setCurrentPage(pageNum);
    } else {
      // Only restore last read if no valid page param
      (async () => {
        const last = await getLastRead();
        if (last && last.page && last.page > 0 && last.page <= TOTAL_PAGES) {
          setCurrentPage(last.page);
        } else {
          setCurrentPage(1);
        }
      })();
    }
  }, [params?.pageNumber]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showSurahPicker, setShowSurahPicker] = useState(false);
  // Removed old LayoutSelector modal state
  const [showAirplanePrompt, setShowAirplanePrompt] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [showPageInput, setShowPageInput] = useState(false);
  const [pageInputValue, setPageInputValue] = useState(String(currentPage));

  // Mushaf bookmarks hook
  const { bookmarks: mushafBookmarks, toggleBookmark: toggleMushafBookmark, saveLastRead, getLastRead } = useMushafBookmarks();

  // Surah list for navigation
  const [surahList, setSurahList] = useState<{ id: number; name: string; page: number }[] | null>(null);
  const [dbReady, setDbReady] = useState<boolean>(isMushafDatabaseReady());

  // Page metadata (Surah/Juz info)
  const [pageMetadata, setPageMetadata] = useState<PageMetadata | null>(null);

  // Theme support
  const { themeMode } = useThemeStore();
  const colors = useCustomColors();
  const isDark = themeMode === 'dark';

  // Load surah list on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await getAllSurahs();
        if (!mounted) return;
        setSurahList(list.map(s => ({ id: s.id, name: s.name, page: s.page })));
        setDbReady(true);
      } catch (e) {
        console.error('[MushafViewerScreen] Error loading surahs:', e);
        setDbReady(isMushafDatabaseReady());
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Check bookmarked status when page changes
  useEffect(() => {
    setIsBookmarked(mushafBookmarks.has(currentPage));
  }, [currentPage, mushafBookmarks]);

  // (last read logic now handled in param effect above)

  // Auto-save last read when page changes
  useEffect(() => {
    saveLastRead(currentPage);
  }, [currentPage, saveLastRead]);

  // Fetch page metadata when page changes
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const db = await initMushafDB();
        const metadata = await getPageMetadata(db, currentPage);
        if (mounted) {
          setPageMetadata(metadata);
        }
      } catch (error) {
        console.error('[MushafViewerScreen] Error fetching metadata:', error);
        if (mounted) {
          setPageMetadata(null);
        }
      }
    })();
    return () => { mounted = false; };
  }, [currentPage]);

  // Show airplane prompt when mushaf is downloaded
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const key = '@mushaf:airplanePromptDisabled';
        const disabled = await AsyncStorage.getItem(key);
        if (!mounted) return;
        if (disabled === '1') {
          setDontAskAgain(true);
          return;
        }

        try {
          const { checkMushafStatus } = await import('../services/mushafDownloadService');
          const status = await checkMushafStatus();
          if (!mounted) return;
          if (status === 'ready') {
            setShowAirplanePrompt(true);
          }
        } catch (e) {
          // Ignore
        }
      } catch (e) {
        console.error('[MushafViewerScreen] Error checking airplane prompt:', e);
      }
    })();

    return () => { mounted = false; };
  }, []);

  // Navigation handlers
  const handleFirst = () => setCurrentPage(1);
  const handlePrev = () => setCurrentPage(p => Math.max(1, p - 1));
  const handleNext = () => setCurrentPage(p => Math.min(TOTAL_PAGES, p + 1));
  const handleLast = () => setCurrentPage(TOTAL_PAGES);

  const handleJumpToPage = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= TOTAL_PAGES) setCurrentPage(pageNum);
  };

  const handleBookmarkToggle = () => {
    toggleMushafBookmark(currentPage);
  };

  const handleClose = () => {
    try { navigation.goBack(); } catch (e) {
      console.error('[MushafViewerScreen] Error going back:', e);
    }
  };

  const handleHome = () => {
    try { router.replace('/'); } catch (e) {
      try { navigation.goBack(); } catch { }
    }
  };

  // Surah navigation helpers
  const findCurrentSurahIndex = (page: number) => {
    if (!surahList || surahList.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < surahList.length; i++) {
      if (surahList[i].page <= page) idx = i;
      else break;
    }
    return idx;
  };

  const handlePrevSurah = () => {
    const idx = findCurrentSurahIndex(currentPage);
    if (idx > 0 && surahList) setCurrentPage(surahList[idx - 1].page);
  };

  const handleNextSurah = () => {
    const idx = findCurrentSurahIndex(currentPage);
    if (surahList && idx >= 0 && idx < surahList.length - 1) setCurrentPage(surahList[idx + 1].page);
  };

  const handleGoToSurah = () => {
    setShowSurahPicker(true);
  };

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={isDark ? "#000000" : "#f5f5f5"} />
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f5f5f5', paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
        {/* Airplane mode prompt modal */}
        <Modal visible={showAirplanePrompt && !dontAskAgain} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Heart size={20} color="#ec4899" fill="#ec4899" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Airplane Mode Recommended</Text>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.modalText}>
                  Recite Allah's words without Notification distractions.
                </Text>
                <View style={styles.checkboxRow}>
                  <Switch
                    value={dontAskAgain}
                    onValueChange={async (value) => {
                      setDontAskAgain(value);
                      await AsyncStorage.setItem('@mushaf:airplanePromptDisabled', value ? '1' : '0');
                    }}
                    trackColor={{ false: '#e0e0e0', true: '#0ea5a4' }}
                    thumbColor={dontAskAgain ? '#f5f5f5' : '#f4f3f4'}
                  />
                  <Text style={styles.checkboxLabel}>Don't show again</Text>
                </View>
              </View>
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.okButton}
                  onPress={() => setShowAirplanePrompt(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.okButtonText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Surah picker modal */}
        <Modal visible={showSurahPicker} animationType="slide">
          <SafeAreaView style={[{
            flex: 1, backgroundColor: '#111',
            paddingTop: Platform.OS === 'android' ? insets.top : 0,
            paddingLeft: insets.left,
            paddingRight: insets.right,
            paddingBottom: insets.bottom
          }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, paddingTop: 12 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>Pick a Surah</Text>
              <TouchableOpacity onPress={() => setShowSurahPicker(false)}>
                <Text style={{ color: '#FFD166', fontSize: 16 }}>Close</Text>
              </TouchableOpacity>
            </View>
            <SurahList
              onClose={() => setShowSurahPicker(false)}
              onSelect={(page) => {
                setShowSurahPicker(false);
                handleJumpToPage(page);
              }}
              extraBottomPadding={32}
            />
          </SafeAreaView>
        </Modal>

        {/* Page input modal */}
        <Modal visible={showPageInput} transparent animationType="fade">
          <SafeAreaView style={modalStyles.overlay}>
            <View style={modalStyles.card}>
              <Text style={modalStyles.title}>Jump to page</Text>
              <TextInput
                value={pageInputValue}
                onChangeText={setPageInputValue}
                keyboardType="numeric"
                style={modalStyles.jumpInput}
                placeholder="Enter page number"
                placeholderTextColor="#666"
              />
              <View style={{ flexDirection: 'row', marginTop: 12, gap: 12 }}>
                <TouchableOpacity
                  style={[modalStyles.button, modalStyles.noButton]}
                  onPress={() => setShowPageInput(false)}
                >
                  <Text style={modalStyles.noText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[modalStyles.button, modalStyles.yesButton]}
                  onPress={() => {
                    const n = Number(pageInputValue);
                    if (!isNaN(n) && n >= 1 && n <= TOTAL_PAGES) setCurrentPage(n);
                    setShowPageInput(false);
                  }}
                >
                  <Text style={modalStyles.yesText}>Go</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </Modal>


        {/* Header with bookmark button */}
        <MushafHeader
          isBookmarked={isBookmarked}
          onBookmarkToggle={handleBookmarkToggle}
          onClose={handleClose}
          onHome={handleHome}
          onChangeLayout={() => router.push('/mushaf/settings')}
          surahName={pageMetadata?.surahName}
          juzNumber={pageMetadata?.juzNumber}
        />

        {/* Main content - Mushaf page with key to force remount */}
        <View style={styles.content}>
          <MushafPage key={`page-${currentPage}`} pageNumber={currentPage} />
        </View>

        {/* Footer with navigation controls */}
        <MushafFooter
          pageNumber={currentPage}
          totalPages={TOTAL_PAGES}
          onPrevious={handlePrev}
          onNext={handleNext}
          onPrevSurah={handlePrevSurah}
          onNextSurah={handleNextSurah}
          onGoToSurah={handleGoToSurah}
          isDbReady={dbReady}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
  },
  modalBody: {
    padding: 20,
  },
  modalText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: 13,
    color: '#64748b',
  },
  modalFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  okButton: {
    backgroundColor: '#0ea5a4',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    minWidth: 100,
    alignItems: 'center',
  },
  okButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  card: {
    width: '86%',
    backgroundColor: '#0b1220',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center'
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center'
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  noButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#334155'
  },
  yesButton: {
    backgroundColor: '#0ea5a4'
  },
  noText: {
    color: '#e2e8f0',
    fontWeight: '600'
  },
  yesText: {
    color: '#042f2e',
    fontWeight: '700'
  },
  jumpInput: {
    width: '100%',
    height: 44,
    backgroundColor: '#071427',
    color: '#fff',
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8
  },
});