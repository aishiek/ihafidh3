import VerseItem from "@/components/VerseItem";
import { surahsData } from "@/data/surahs";
import { getSurahById, isSurahFullyCached } from "@/services/quranApi";
import { useProgressStore } from "@/store/progressStore";
import { useSettingsStore } from '@/store/settingsStore';
import { getAudioUrl, playAudio } from '@/utils/audioUtils';
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowRight } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import LayoutService from '../mushaf/services/layoutService';
import { logAnalyticsEvent, buildMemorizationAnalyticsPayload } from '@/utils/analyticsHelper';

export default function SurahScreen() {
  const { id: surahId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [surah, setSurah] = useState<any>(null);
  const BATCH_SIZE = 20; // Local DB is fast; use larger batches
  const [verses, setVerses] = useState<any[]>([]); // currently loaded batches
  const [totalVerses, setTotalVerses] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [allVersesLoaded, setAllVersesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isCached, setIsCached] = useState(false);
  const fullSurahRef = useRef<any | null>(null);

  // Progress store integration
  const { 
    memorizedVerses, 
    revisedVerses, 
    markVerseAsMemorized,
    unmarkVerseAsMemorized,
    markVerseAsRevised,
    unmarkVerseAsRevised,
    bulkMarkVersesMemorized,
    bulkMarkVersesRevised
  } = useProgressStore();

  // Audio URL cache to avoid regenerating/checking availability repeatedly
  const audioUrlCacheRef = useRef<Record<string, string>>({});
  const { reciterIdentifier, fontSizeArabic } = useSettingsStore();

  // FlatList ref + jump-to-index support (preferred over measuring)
  const flatListRef = useRef<any | null>(null);

  // CRITICAL FIX: Dynamic item height based on font size
  // Small fonts (16-24): ~140px, Medium (28-36): ~200px, Large (40-52): ~300px, XL (56+): ~400px
  const ESTIMATED_ITEM_HEIGHT = useMemo(() => {
    if (fontSizeArabic <= 24) return 140;
    if (fontSizeArabic <= 36) return 220;
    if (fontSizeArabic <= 52) return 320;
    return 450; // Very large fonts
  }, [fontSizeArabic]);

  const getItemLayout = useCallback(
    (_data: any, index: number) => ({ 
      length: ESTIMATED_ITEM_HEIGHT, 
      offset: ESTIMATED_ITEM_HEIGHT * index, 
      index 
    }),
    [ESTIMATED_ITEM_HEIGHT]
  );

  const handleScrollToIndexFailed = (info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
    const offset = info.averageItemLength * info.index;
    flatListRef.current?.scrollToOffset({ offset, animated: true });
  };

  const jumpToVerse = (verseNumber: number) => {
    const verseIndex = verses.findIndex(v => (v.verseNumber ?? v.number) === verseNumber);
    if (verseIndex >= 0) {
      try {
        flatListRef.current?.scrollToIndex({ index: verseIndex, animated: true, viewPosition: 0 });
        return true;
      } catch (err) {
        console.warn('[SurahScreen] scrollToIndex failed, will fallback to offset:', err);
        const approxOffset = ESTIMATED_ITEM_HEIGHT * verseIndex;
        flatListRef.current?.scrollToOffset({ offset: approxOffset, animated: true });
        return false;
      }
    }
    console.warn('[SurahScreen] jumpToVerse: verse not found in current data', verseNumber);
    return false;
  };

  const handlePlayAudio = useCallback(async (surahNum: number, verseNum: number, _globalId?: number, repeats?: number, isInfinite?: boolean) => {
    try {
      const key = `${surahNum}:${verseNum}:${reciterIdentifier}`;
      let url = audioUrlCacheRef.current[key];
      if (!url) {
        // Synchronous URL construction (no network checks)
        url = getAudioUrl(reciterIdentifier, surahNum, verseNum);
        audioUrlCacheRef.current[key] = url;
      }
      // Play audio: use repeats passed from VerseItem or default to 1
      const repeatCountToUse = typeof repeats === 'number' ? repeats : 1;
      const infinite = !!isInfinite;
      await playAudio(url, repeatCountToUse, (status) => {
        // optional: update UI or store based on status
      });
    } catch (e) {
      console.error('Failed to play audio:', e);
      Alert.alert('Audio Error', 'Failed to play audio.');
    }
  }, [reciterIdentifier]);

  // 🔹 Load Surah
  const loadSurah = useCallback(async () => {
    try {
      const surahIdNum = parseInt(surahId, 10);
      const surahData = await getSurahById(surahIdNum);
      setSurah(surahData);

      const fullyCached = await isSurahFullyCached(surahIdNum);
      setIsCached(fullyCached);

      if (surahData) {
        // store full surah verses in a ref for incremental loading
        fullSurahRef.current = surahData;
        const total = surahData.versesCount || (surahData.verses || []).length || 0;
        setTotalVerses(total);

        // load only the first batch
        const firstBatch = (surahData.verses || []).slice(0, BATCH_SIZE);
        setVerses(firstBatch);
        setCurrentBatch(firstBatch.length > 0 ? 1 : 0);
        setAllVersesLoaded((firstBatch.length || 0) >= total);
      }
    } catch (err) {
      console.error("❌ ERROR loading verses:", err);
    } finally {
      setLoading(false);
    }
  }, [surahId]);

  useEffect(() => {
    loadSurah();
  }, [loadSurah]);

  // Surah-level state checking
  const isSurahMemorizedGlobally = useMemo(() => {
    if (!surah) return false;
    // compute full id range for surah using totalVerses
    const total = totalVerses || surah.versesCount || 0;
    let start = 0; for (let i = 1; i < surah.id; i++) { const s = surahsData.find(ss => ss.id === i)!; start += s.versesCount; }
    const allIds = Array.from({length: total}, (_, i) => start + 1 + i);
    return allIds.length > 0 && allIds.every((id: number) => memorizedVerses.includes(id));
  }, [surah, memorizedVerses, totalVerses]);

  const isSurahRevisedGlobally = useMemo(() => {
    if (!surah) return false;
    const total = totalVerses || surah.versesCount || 0;
    let start = 0; for (let i = 1; i < surah.id; i++) { const s = surahsData.find(ss => ss.id === i)!; start += s.versesCount; }
    const allIds = Array.from({length: total}, (_, i) => start + 1 + i);
    return allIds.length > 0 && allIds.every((id: number) => revisedVerses.some(rv => rv.verseId === id));
  }, [surah, revisedVerses, totalVerses]);

  // Individual verse handlers
  const handleVerseMemorizeToggle = useCallback((verseId: number) => {
    if (memorizedVerses.includes(verseId)) {
      unmarkVerseAsMemorized(verseId);
    } else {
      markVerseAsMemorized(verseId);
    }
  }, [memorizedVerses, unmarkVerseAsMemorized, markVerseAsMemorized]);

  const handleVerseRevisionToggle = useCallback((verseId: number) => {
    const isRevised = revisedVerses.some(rv => rv.verseId === verseId);
    if (isRevised) {
      unmarkVerseAsRevised(verseId);
    } else {
      markVerseAsRevised(verseId);
    }
  }, [revisedVerses, markVerseAsRevised, unmarkVerseAsRevised]);

  // 🔹 Action Handlers
  const handlePlaySurah = () => {
    console.log("▶️ Playing surah...");
    // integrate your audioUtils play logic here
  };

  // Track active layout so we can hide the full-surah play control for Warsh
  const [isWarshLayout, setIsWarshLayout] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function checkLayout() {
      try {
        const active = await LayoutService.getActiveLayoutId();
        if (!mounted) return;
        setIsWarshLayout(active === 'warsh_15');
      } catch (e) {
        // default to false (show controls) on error
      }
    }

    checkLayout();

    // also react to layout DB swaps
    const unsub = LayoutService.onDatabaseChange(async () => {
      try {
        const active = await LayoutService.getActiveLayoutId();
        if (!mounted) return;
        setIsWarshLayout(active === 'warsh_15');
      } catch (e) {}
    });

    return () => { mounted = false; unsub(); };
  }, []);

  // Go-to-verse modal state
  const [showGoModal, setShowGoModal] = useState(false);
  const [goInput, setGoInput] = useState('');
  const [goInputError, setGoInputError] = useState<string | null>(null);
  const [goSubmitting, setGoSubmitting] = useState(false);

  // Ensure surah window (a batch centered around target) is loaded and then jump
  const ensureSurahWindowAndJump = async (verseNumber: number) => {
    if (!fullSurahRef.current) {
      // try to reload surah data
      try {
        const surahNum = parseInt(surahId, 10);
        const fresh = await getSurahById(surahNum);
        fullSurahRef.current = fresh;
        if (fresh) setTotalVerses(fresh.versesCount || (fresh.verses || []).length || 0);
      } catch (err) {
        console.warn('[SurahScreen] Failed to reload surah while attempting Go-to-verse', err);
      }
    }

    const surahData = fullSurahRef.current;
    if (!surahData || !(surahData.verses || []).length) {
      Alert.alert('Not available', 'Unable to locate the requested Surah data.');
      return false;
    }

    const targetIdx = (surahData.verses || []).findIndex((v: any) => (v.verseNumber ?? v.number) === verseNumber);
    if (targetIdx < 0) {
      Alert.alert('Invalid verse', `Verse ${verseNumber} not found in this Surah.`);
      return false;
    }

    // If current loaded batches already include the verse, just jump
    const localIdx = verses.findIndex(v => (v.verseNumber ?? v.number) === verseNumber);
    if (localIdx >= 0) {
      try {
        flatListRef.current?.scrollToIndex({ index: localIdx, animated: true, viewPosition: 0 });
      } catch (err) {
        const approxOffset = ESTIMATED_ITEM_HEIGHT * localIdx;
        flatListRef.current?.scrollToOffset({ offset: approxOffset, animated: true });
      }
      return true;
    }

    // Otherwise, construct a centered window around the target so user can scroll forward/back
    const half = Math.floor(BATCH_SIZE / 2);
    const start = Math.max(0, targetIdx - half);
    const end = Math.min((surahData.verses || []).length, start + BATCH_SIZE);
    const window = (surahData.verses || []).slice(start, end);

    // Replace currently loaded verses with the focused window and then scroll to the item
    setVerses(window);
    setAllVersesLoaded(end >= (surahData.versesCount || surahData.vers.length));

    // Wait for FlatList to render the new window using requestAnimationFrame (faster than setTimeout)
    await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
    const idxInWindow = targetIdx - start;
    try {
      flatListRef.current?.scrollToIndex({ index: idxInWindow, animated: true, viewPosition: 0 });
    } catch (err) {
      const approxOffset = ESTIMATED_ITEM_HEIGHT * idxInWindow;
      flatListRef.current?.scrollToOffset({ offset: approxOffset, animated: true });
    }

    return true;
  };

  const handleGoConfirm = async () => {
    setGoInputError(null);
    const n = parseInt(goInput.trim(), 10);
    if (!n || n < 1 || n > (totalVerses || 0)) {
      setGoInputError(`Enter a number between 1 and ${totalVerses || 0}`);
      return;
    }

    setGoSubmitting(true);
    try {
      // If surah is cached locally fully we can directly jump; otherwise ensure window
      if (isCached) {
        const ok = jumpToVerse(n);
        if (!ok) {
          // fallback to windowed approach
          await ensureSurahWindowAndJump(n);
        }
      } else {
        await ensureSurahWindowAndJump(n);
      }
      setShowGoModal(false);
    } catch (err) {
      console.warn('[SurahScreen] Go-to-verse failed:', err);
      Alert.alert('Error', 'Failed to jump to verse. Please try again.');
    } finally {
      setGoSubmitting(false);
    }
  };

  const handleMarkMemorized = useCallback(async () => {
    if (!surah) return;
    let start = 0; for (let i = 1; i < surah.id; i++) { const s = surahsData.find(ss => ss.id === i)!; start += s.versesCount; }
    const surahVerseIds = Array.from({length: surah.versesCount}, (_, i) => start + 1 + i);
    const isCurrentlyMemorized = isSurahMemorizedGlobally;
    try {
      if (isCurrentlyMemorized) {
        await bulkMarkVersesMemorized(surahVerseIds, false);
      } else {
        await bulkMarkVersesMemorized(surahVerseIds, true);
      }

      // ANALYTICS: Surah-level memorization toggle
      const pagesCount = Math.ceil(surah.versesCount / 15); // standard estimate
      const { getJuzForSurah } = require('@/utils/juzCalculator');
      const juzNum = typeof getJuzForSurah === 'function' ? getJuzForSurah(surah.id) : 0;

      logAnalyticsEvent('surah_memorization_toggled', buildMemorizationAnalyticsPayload({
        event_scope: 'surah',
        action: isCurrentlyMemorized ? 'unmark_memorized' : 'mark_memorized',
        state: isCurrentlyMemorized ? 'unmemorized' : 'memorized',
        trigger_source: 'surah_bulk_action',
        surah_id: surah.id,
        surah_name: surah.name || surah.englishName,
        verses_count: surah.versesCount,
        pages_count: pagesCount,
        juz_number: juzNum,
      }));
    } catch (error) {
      console.error('Failed to toggle surah memorization:', error);
      Alert.alert('Error', 'Failed to update memorization status. Please try again.');
    }
  }, [surah, isSurahMemorizedGlobally, bulkMarkVersesMemorized, memorizedVerses, unmarkVerseAsMemorized]);

  const handleMarkRevised = useCallback(async () => {
    if (!surah) return;
    let start = 0; for (let i = 1; i < surah.id; i++) { const s = surahsData.find(ss => ss.id === i)!; start += s.versesCount; }
    const surahVerseIds = Array.from({length: surah.versesCount}, (_, i) => start + 1 + i);
    const isCurrentlyRevised = isSurahRevisedGlobally;
    try {
      if (isCurrentlyRevised) {
        await bulkMarkVersesRevised(surahVerseIds, false);
      } else {
        await bulkMarkVersesRevised(surahVerseIds, true);
      }

      // ANALYTICS: Surah-level revision toggle
      const pagesCount = Math.ceil(surah.versesCount / 15);
      const { getJuzForSurah } = require('@/utils/juzCalculator');
      const juzNum = typeof getJuzForSurah === 'function' ? getJuzForSurah(surah.id) : 0;

      logAnalyticsEvent('surah_revision_toggled', {
        action: isCurrentlyRevised ? 'unmark_revised' : 'mark_revised',
        surah_number: surah.id,
        surah_name: surah.name || surah.englishName,
        verses_count: surah.versesCount,
        pages_count: pagesCount,
        juz_number: juzNum,
        completion_type: 'manual_bulk',
      });
    } catch (error) {
      console.error('Failed to toggle surah revision:', error);
      Alert.alert('Error', 'Failed to update revision status. Please try again.');
    }
  }, [surah, isSurahRevisedGlobally, bulkMarkVersesRevised, unmarkVerseAsRevised]);

  // Load next batch when user scrolls near the end
  const loadNextBatch = useCallback(async () => {
    if (isLoadingMore || allVersesLoaded) return;
    if (!fullSurahRef.current) return;

    setIsLoadingMore(true);
    try {
      const surahData = fullSurahRef.current;
      const alreadyLoaded = verses.length;
      const nextStart = alreadyLoaded;
      const nextEnd = Math.min(alreadyLoaded + BATCH_SIZE, surahData.verses.length);
      if (nextStart >= nextEnd) {
        setAllVersesLoaded(true);
        setIsLoadingMore(false);
        return;
      }

      // simulate small delay for perceived responsiveness (optional)
      // await new Promise(r => setTimeout(r, 100));

      const nextBatch = surahData.verses.slice(nextStart, nextEnd);
      setVerses(prev => [...prev, ...nextBatch]);
      setCurrentBatch(prev => prev + 1);
      if (nextEnd >= (surahData.versesCount || surahData.verses.length)) {
        setAllVersesLoaded(true);
      }
    } catch (e) {
      console.error('Error loading next batch:', e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, allVersesLoaded, verses.length]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!surah) {
    return (
      <View style={styles.center}>
        <Text>⚠️ Failed to load Surah</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 🔹 Surah Title */}
      <View style={styles.header}>
        {/* Centered Arabic and English names with surah number */}
        <Text style={styles.title}>{surah.arabicName}</Text>
        <Text style={styles.subtitle}>
          {surah.id}. {surah.englishName} • {surah.versesCount} Ayahs
        </Text>
      </View>

      {/* 🔹 Actions (Unified Buttons) */}
      <View style={styles.actions}>
        <View style={{ flex: 1, marginHorizontal: 4, flexDirection: 'row', alignItems: 'center' }}>
          {/* Hide full-surah play in Warsh layout since full-surah audio mappings are disabled */}
          {!isWarshLayout && (
            <Pressable
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: 8,
                alignItems: 'center',
                backgroundColor: '#1976D2',
                borderColor: '#1976D2',
                borderWidth: 1,
              }}
              android_ripple={{ color: 'transparent' }}
              onPress={handlePlaySurah}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>
                ▶️ Play Surah
              </Text>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to verse"
            onPress={() => setShowGoModal(true)}
            style={{
              width: 44,
              height: 44,
              marginLeft: 8,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFD700',
            }}
          >
            <ArrowRight size={18} color="#000000" />
          </Pressable>
        </View>
        <Pressable
          style={{
            flex: 1,
            marginHorizontal: 4,
            paddingVertical: 9,
            borderRadius: 8,
            alignItems: 'center',
            backgroundColor: isSurahMemorizedGlobally ? '#4CAF50' : '#333333',
            borderColor: isSurahMemorizedGlobally ? '#4CAF50' : '#666666',
            borderWidth: 1,
          }}
          android_ripple={{ color: 'transparent' }}
          onPress={handleMarkMemorized}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>
            {isSurahMemorizedGlobally ? '✓ Unmark Memorized' : '✓ Mark Memorized'}
          </Text>
        </Pressable>
        <Pressable
          style={{
            flex: 1,
            marginHorizontal: 4,
            paddingVertical: 9,
            borderRadius: 8,
            alignItems: 'center',
            backgroundColor: isSurahRevisedGlobally ? '#FF9800' : '#333333',
            borderColor: isSurahRevisedGlobally ? '#FF9800' : '#666666',
            borderWidth: 1,
          }}
          android_ripple={{ color: 'transparent' }}
          onPress={handleMarkRevised}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>
            {isSurahRevisedGlobally ? '⟳ Unmark Revision' : '⟳ Mark Revision'}
          </Text>
        </Pressable>
      </View>

      {/* 🔹 Verse List */}
      <FlashList
        data={verses}
        keyExtractor={(item: any) => item.id?.toString?.() ?? String(item.verseNumber ?? Math.random())}
        renderItem={({ item }: { item: any }) => (
          <VerseItem
            verse={item}
            onPlayAudio={(surahNum, verseNum, globalId, repeats, isInfinite) => handlePlayAudio(surahNum, verseNum, globalId, repeats, isInfinite)}
            surahMemorizedGlobally={isSurahMemorizedGlobally}
            surahRevisedGlobally={isSurahRevisedGlobally}
            onSurahMemorizeToggle={handleMarkMemorized}
            onSurahRevisionToggle={handleMarkRevised}
            moveToVerse={(v: number) => jumpToVerse(v)}
          />
        )}
        contentContainerStyle={styles.verseList}
        onEndReached={loadNextBatch}
        onEndReachedThreshold={0.5}
        ListFooterComponent={isLoadingMore ? <ActivityIndicator style={{ margin: 12 }} /> : null}
        ref={flatListRef as any}
      />

      <Modal
        visible={showGoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGoModal(false)}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowGoModal(false)}>
          <View style={{ width: '90%', maxWidth: 360, backgroundColor: '#2a2a2a', borderRadius: 12, padding: 18 }} onStartShouldSetResponder={() => true}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12, textAlign: 'center' }}>Go to verse</Text>
            <Text style={{ color: '#ccc', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>Enter verse number (1 - {totalVerses || 0})</Text>
            <TextInput
              value={goInput}
              onChangeText={setGoInput}
              keyboardType="number-pad"
              placeholder="Verse number"
              placeholderTextColor="#666"
              style={{ backgroundColor: '#151515', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: goInputError ? '#ff6b6b' : '#374151', textAlign: 'center', marginBottom: 8 }}
            />
            {goInputError ? <Text style={{ color: '#ff6b6b', marginBottom: 8, textAlign: 'center' }}>{goInputError}</Text> : null}

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <TouchableOpacity onPress={() => { setShowGoModal(false); setGoInput(''); setGoInputError(null); }} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#374151', marginRight: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleGoConfirm} disabled={goSubmitting} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#4a90e2' }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{goSubmitting ? 'Going...' : 'Go'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* 🔹 Continue Reading Example */}
      {/* Footer/tab bar handled by global layout, remove ThemedButton */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#1a1a1a', 
    padding: 16 
  },
  center: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#1a1a1a' 
  },
  header: { 
    marginBottom: 16,
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#fff', 
    marginBottom: 4,
    textAlign: 'center'
  },
  subtitle: { 
    fontSize: 14, 
    color: '#FFD700', 
    marginBottom: 8,
    textAlign: 'center'
  },
  actions: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 16 
  },
  verseList: { 
    paddingBottom: 32 
  },
});
