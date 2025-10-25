import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, SafeAreaView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LayoutSelector } from '../components/LayoutSelector';
import MushafFooter from '../components/MushafFooter';
import MushafHeader from '../components/MushafHeader';
import MushafPage from '../components/MushafPage';
import SurahList from '../components/SurahList';
import { useMushafBookmarks } from '../hooks/useMushafBookmarks';
import LayoutService from '../services/layoutService';
import { getAllSurahs, isMushafDatabaseReady } from '../services/mushafSurahService';

const TOTAL_PAGES = 610;

export default function MushafViewerScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const paramsAny = (router as any).query || {};
  const initialPage = Number(paramsAny?.pageNumber) || 1;
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showSurahPicker, setShowSurahPicker] = useState(false);
  const [showLayoutSelector, setShowLayoutSelector] = useState(false);
  const { bookmarks: mushafBookmarks, toggleBookmark: toggleMushafBookmark } = useMushafBookmarks();
  const [showAirplanePrompt, setShowAirplanePrompt] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [showPageInput, setShowPageInput] = useState(false);
  const [pageInputValue, setPageInputValue] = useState(String(initialPage));

  // Only show prompt when Mushaf is downloaded and user hasn't disabled prompt
  React.useEffect(() => {
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

        // Lazy-check if mushaf is installed
        try {
          const { checkMushafStatus } = await import('../services/mushafDownloadService');
          const status = await checkMushafStatus();
          if (!mounted) return;
          if (status === 'ready') {
            setShowAirplanePrompt(true);
          }
        } catch (e) {
          // ignore failures to check; do not block viewer
        }
      } catch (e) {
        // ignore storage errors
      }
    })();

    return () => { mounted = false; };
  }, []);

  React.useEffect(() => {
    setIsBookmarked(mushafBookmarks.has(currentPage));
  }, [currentPage, mushafBookmarks]);

  const handleFirst = () => setCurrentPage(1);
  const handlePrev = () => setCurrentPage(p => Math.max(1, p - 1));
  const handleNext = () => setCurrentPage(p => Math.min(TOTAL_PAGES, p + 1));
  const handleLast = () => setCurrentPage(TOTAL_PAGES);

  const handleJumpToPage = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= TOTAL_PAGES) setCurrentPage(pageNum);
  };

  const handleBookmarkToggle = () => {
    toggleMushafBookmark(currentPage);
    setIsBookmarked(mushafBookmarks.has(currentPage));
  };

  const handleClose = () => {
    try { navigation.goBack(); } catch (e) { /* ignore */ }
  };

  const handleHome = () => {
    try { router.replace('/'); } catch (e) { try { navigation.goBack(); } catch {} }
  };

  // Surah navigation helpers
  const [surahList, setSurahList] = React.useState<{id:number; name:string; page:number}[] | null>(null);
  const [dbReady, setDbReady] = React.useState<boolean>(isMushafDatabaseReady());

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await getAllSurahs();
        if (!mounted) return;
        setSurahList(list.map(s => ({ id: s.id, name: s.name, page: s.page })));
        setDbReady(true);
      } catch (e) {
        // ignore - optional
        setDbReady(isMushafDatabaseReady());
      }
    })();
    return () => { mounted = false; };
  }, []);

  const findCurrentSurahIndex = (page: number) => {
    if (!surahList || surahList.length === 0) return -1;
    // Find the last surah whose start page <= page
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
    // open surah picker modal
    setShowSurahPicker(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Airplane prompt modal — shown when opening downloaded Mushaf */}
      <Modal visible={showAirplanePrompt && !dontAskAgain} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Airplane Mode Recommended</Text>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                Enable Airplane Mode for undistracted reading.
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
      <MushafHeader
        isBookmarked={isBookmarked}
        onBookmarkToggle={handleBookmarkToggle}
        onClose={handleClose}
        onHome={handleHome}
        onChangeLayout={() => setShowLayoutSelector(true)}
      />

      <View style={styles.content}>
        {/* contentHeader removed per request: page indicator strip hidden */}

        <MushafPage pageNumber={currentPage} />
      </View>

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
            />
            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              <TouchableOpacity style={[modalStyles.button, modalStyles.noButton]} onPress={() => setShowPageInput(false)}>
                <Text style={modalStyles.noText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[modalStyles.button, modalStyles.yesButton]} onPress={() => {
                const n = Number(pageInputValue);
                if (!isNaN(n) && n >= 1 && n <= TOTAL_PAGES) setCurrentPage(n);
                setShowPageInput(false);
              }}>
                <Text style={modalStyles.yesText}>Go</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={showSurahPicker} animationType="slide">
        <SafeAreaView style={{ flex:1, backgroundColor:'#111' }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', padding:12 }}>
            <Text style={{ color:'#fff', fontWeight:'700' }}>Pick a Surah</Text>
            <TouchableOpacity onPress={() => setShowSurahPicker(false)}><Text style={{ color:'#FFD166' }}>Close</Text></TouchableOpacity>
          </View>
          <SurahList onClose={() => setShowSurahPicker(false)} onSelect={(page) => { console.log(`[MushafViewer] Surah selected -> jump to page ${page}`); setShowSurahPicker(false); handleJumpToPage(page); }} />
        </SafeAreaView>
      </Modal>

      <LayoutSelector visible={showLayoutSelector} onClose={() => setShowLayoutSelector(false)} onLayoutSelected={async (layoutId) => {
        // Preserve reading position across layouts by mapping current surah.
        try {
          // Find the current surah in the old (currently active) layout
          const currentPageSnapshot = currentPage;
          const surahInfo = await LayoutService.getSurahForPage(currentPageSnapshot);

          // Switch active layout
          const success = await LayoutService.setActiveLayout(layoutId);
          setShowLayoutSelector(false);

          if (!success) {
            alert('Failed to switch layout');
            return;
          }

          // If we could identify the surah in the previous layout, jump to the
          // equivalent surah start page in the new layout. Otherwise fall back
          // to page 1.
          if (surahInfo && surahInfo.surah_number) {
            const newStart = await LayoutService.getSurahStartPage(surahInfo.surah_number);
            setCurrentPage(newStart || 1);
          } else {
            setCurrentPage(1);
          }
        } catch (e) {
          console.error('Error switching layout with position preservation', e);
          setShowLayoutSelector(false);
          setCurrentPage(1);
        }
      }} />

        {/* Footer with page and surah controls */}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { marginBottom: 8 },
  content: { 
    flex: 1,
    paddingTop: 40,      // Add ~1.5cm (40px) spacing from header
    paddingBottom: 20,   // Reduce gap between last line and footer
  },
  contentHeader: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#0b1220' },
  surahTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pageIndicator: { color: '#d1d5db', fontSize: 12, marginTop: 4 },
  bottomBar: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e6e6e6', paddingBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  rowSecondary: { backgroundColor: '#fff' },
  navBtn: { minWidth: 96, height: 44, borderRadius: 8, backgroundColor: '#0ea5a4', alignItems: 'center', justifyContent: 'center' },
  navBtnText: { color: '#fff', fontWeight: '700' },
  pageSelector: { minWidth: 80, height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45, backgroundColor: '#ddd' },
  surahNavBtn: { minWidth: 96, height: 44, borderRadius: 8, backgroundColor: '#FFD166', alignItems: 'center', justifyContent: 'center' },
  surahNavText: { color: '#1a1a2e', fontWeight: '700' },
  currentSurahInfo: { alignItems: 'center', flex: 1 },
  currentSurahText: { fontWeight: '700' },
  currentSurahSub: { fontSize: 12, color: '#666' },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    gap: 12,
  },
  navButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, backgroundColor: '#FFA500' },
  navButtonDisabled: { backgroundColor: '#ccc', opacity: 0.5 },
  navButtonText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  pageText: { fontSize: 14, color: '#666', fontWeight: '500' },
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  card: { width: '86%', backgroundColor: '#0b1220', borderRadius: 12, padding: 18, alignItems: 'center' },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#034d4a', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  message: { color: '#d1d5db', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  smallText: { color: '#cbd5e1', marginLeft: 8 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  buttonsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  button: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginHorizontal: 6 },
  noButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#334155' },
  yesButton: { backgroundColor: '#0ea5a4' },
  noText: { color: '#e2e8f0', fontWeight: '600' },
  yesText: { color: '#042f2e', fontWeight: '700' },
  jumpInput: { width: '100%', height: 44, backgroundColor: '#071427', color: '#fff', paddingHorizontal: 12, borderRadius: 8, marginTop: 8 },
});
