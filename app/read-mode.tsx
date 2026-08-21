/**
 * ReadModeScreen.tsx
 * Updated with Robust navigation-back logic.
 */

import type { FlashListRef } from '@shopify/flash-list';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Pause, Play, Sun } from 'lucide-react-native';
import { WBWIcon } from '../components/icons/WBWIcon';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    Animated,
    BackHandler,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';
import { ReadModeVerseCard } from '../components/ReadModeVerseCard';
import { ReadingProgressBar } from '../components/ReadModeScrollProgress';
import TafsirModal from '../components/TafsirModal';
import { fetchAllStats } from '../services/communityStatsService';
import { fetchVersesForJuz } from '../services/juzDbService';
import { getVersesBySurah } from '../data/verses';
import { getSurahById } from '../data/surahs';
import { useBookmarkStore } from '../store/bookmarkStore';
import { useFavouriteStore } from '../store/favouriteStore';
import { useReadModeStore } from '../store/readModeStore';
import { useSettingsStore } from '../store/settingsStore';
import { useActivityStore } from '../store/activityStore';
import { Verse } from '../types/verse';
import { pauseSurahAudio, playSurahAudioWithFallback } from '../utils/audioUtils';
import { logScreenView } from '../utils/analyticsHelper';

// Helper to parse navigation params
const parseSnapshot = (params: any) => ({
    surahId: Number(params.surahId),
    verseNumber: Number(params.verseNumber),
    juzNumber: params.juzNumber ? Number(params.juzNumber) : undefined,
    arabicText: params.arabicText as string,
    transliteration: params.transliteration && params.transliteration !== 'null' ? (params.transliteration as string) : null,
    translation: params.translation && params.translation !== 'null' ? (params.translation as string) : null,
    surahName: params.surahName as string,
    source: params.source as string,
});

export default function ReadModeScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const { 
        showTransliteration,
        showTranslation,
        readModeLightTheme, 
        setReadModeLightTheme, 
        wbwEnabled, 
        translationLanguage,
        fontSizeArabic,
        fontSizeTranslation
    } = useSettingsStore();
    const isParchmentLight = readModeLightTheme;

    const [isWbwActive, setIsWbwActive] = useState(true);

    const snapshot = useRef(parseSnapshot(params)).current;
    const isJuzMode = snapshot.source === 'juzList' && !!snapshot.juzNumber;

    const [verses, setVerses] = useState<Verse[]>([]);
    const [visibleSurahId, setVisibleSurahId] = useState(snapshot.surahId);
    const [visibleVerseNumber, setVisibleVerseNumber] = useState(snapshot.verseNumber);
    const [visibleVerseIndex, setVisibleVerseIndex] = useState(0);
    const [showTafsirModal, setShowTafsirModal] = useState(false);
    const [tafsirVerse, setTafsirVerse] = useState<{ surahId: number; verseNumber: number } | null>(null);
    const [isPlayingSurah, setIsPlayingSurah] = useState(false);
    const [isSurahPaused, setIsSurahPaused] = useState(false);
    
    // Reading progress bar: updated by handleScroll
    const scrollProgressAnim = useRef(new Animated.Value(0)).current;
    const lastProgressRef = useRef(0);
    const lastOffsetYRef = useRef(0);
    const isTransitioningRef = useRef(false);

    // Reset progress when screen mounts and track session
    useEffect(() => {
        useActivityStore.getState().startSession();
        isTransitioningRef.current = true;
        lastProgressRef.current = 0;
        lastOffsetYRef.current = 0;
        scrollProgressAnim.setValue(0);
        const t = setTimeout(() => {
            isTransitioningRef.current = false;
        }, 400);
        return () => {
            clearTimeout(t);
            useActivityStore.getState().endSession();
        };
    }, []);

    // Community favourite counts (the heart-icon "5K" badge on each verse) come from
    // an in-memory cache in communityStatsService that only gets populated by whichever
    // screen last called fetchAllStats() — Read Mode never called it itself, so opening
    // Read Mode directly (without having just visited Stats) always showed the local-only
    // count. Fetch it here too, and bump a version counter on success so the currently
    // visible verse cards (which read the cache synchronously, not reactively) re-render
    // and pick up the real numbers once they arrive.
    const [communityStatsVersion, setCommunityStatsVersion] = useState(0);
    useEffect(() => {
        let cancelled = false;
        fetchAllStats()
            .then(() => {
                if (!cancelled) setCommunityStatsVersion(v => v + 1);
            })
            .catch(() => { /* silent — cards just keep showing local-only counts */ });
        return () => { cancelled = true; };
    }, []);

    const flashListRef = useRef<FlashListRef<Verse>>(null);
    const hasScrolled = useRef(false);
    const initialScrollDoneRef = useRef(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const bookmarkBusyRef = useRef(false);
    const isExiting = useRef(false);

    const lastVisibleVerseNumberRef = useRef(snapshot.verseNumber);
    const lastVisibleSurahIdRef = useRef(snapshot.surahId);
    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 40, minimumViewTime: 100 }).current;

    const [showWbwTooltip, setShowWbwTooltip] = useState(false);
    const [selectedWbwTranslation, setSelectedWbwTranslation] = useState<string | null>(null);
    // Tracks which verse card currently owns the WBW pill (surahId-verseNumber)
    const activeWbwCardKeyRef = useRef<string | null>(null);
    const bookmarksSet = useBookmarkStore((state) => state.bookmarksSet);
    const { isFavourited, addFavourite, removeFavourite } = useFavouriteStore();

    const routerRef = useRef(router);
    routerRef.current = router;

    const handlePortraitReturn = useCallback(() => {
        if (isExiting.current) return;
        isExiting.current = true;

        // 1. Store the exact state for handoff to portrait screen
        useReadModeStore.getState().setLastVisibleVerse(
            lastVisibleSurahIdRef.current,
            lastVisibleVerseNumberRef.current,
        );

        if (isJuzMode && snapshot.juzNumber) {
            useReadModeStore.getState().setLastVisibleJuz(snapshot.juzNumber);
        }

        // Synchronous flag so read tab's useFocusEffect does not reset before
        // getOrientationAsync resolves (lastVisibleVerse may be cleared by then).
        useReadModeStore.getState().setPendingPortraitHandoff(true);

        // 2. Perform simple back navigation
        if (routerRef.current.canGoBack()) {
            routerRef.current.back();
        } else {
            routerRef.current.replace('/(tabs)/read');
        }
    }, [isJuzMode, snapshot.juzNumber, snapshot.source]);

    // Analytics: Track read_mode screen view on mount (outside Expo Router nav tree)
    useEffect(() => {
        logScreenView('read_mode').catch(() => {});
    }, []);

    useEffect(() => {
        isExiting.current = false;

        // Suppress portrait-return events briefly during any lock/unlock cycle
        let isInitialLockCycle = true;

        const initOrientation = async () => {
            try {
                const current = await ScreenOrientation.getOrientationAsync();
                const alreadyLandscape =
                    current === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
                    current === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;

                if (!alreadyLandscape) {
                    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT).catch(() => {
                        return ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
                    });
                    await new Promise(resolve => setTimeout(resolve, 600));
                    await ScreenOrientation.unlockAsync().catch(() => {});
                }
            } catch {
                ScreenOrientation.unlockAsync().catch(() => {});
            } finally {
                isInitialLockCycle = false;
            }
        };

        initOrientation();

        const subscription = ScreenOrientation.addOrientationChangeListener((evt) => {
            if (isInitialLockCycle) return;
            const orientation = evt.orientationInfo.orientation;
            if (
                orientation === ScreenOrientation.Orientation.PORTRAIT_UP ||
                orientation === ScreenOrientation.Orientation.PORTRAIT_DOWN
            ) {
                handlePortraitReturn();
            }
        });

        setSelectedWbwTranslation(null);

        return () => {
            subscription.remove();
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
            pauseSurahAudio().catch(() => {});
            setTimeout(() => {
                ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
                    .then(() => setTimeout(() => ScreenOrientation.unlockAsync().catch(() => {}), 500))
                    .catch(() => {});
            }, 350);
            StatusBar.setHidden(false);
        };
    }, [handlePortraitReturn]);


    useEffect(() => {
        const onBackPress = () => {
            handlePortraitReturn();
            return true;
        };
        const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => sub.remove();
    }, [handlePortraitReturn]);

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            try {
                let processedVerses: Verse[];
                if (isJuzMode && snapshot.juzNumber) {
                    const rawVerses = await fetchVersesForJuz(snapshot.juzNumber);
                    processedVerses = rawVerses.map((jv) => ({
                        id: jv.verse_id,
                        surahId: jv.chapter_id,
                        verseNumber: jv.verse_number,
                        arabicText: jv.ayah,
                        translation: jv.translation || '',
                        juzNumber: jv.part_id,
                        transliteration: jv.transliteration,
                        pageNumber: jv.page_id ? Number(jv.page_id) : undefined,
                    }));
                } else {
                    processedVerses = await getVersesBySurah(snapshot.surahId, 1, 1000);
                }
                if (!isMounted) return;
                setVerses(processedVerses);
                // Trigger scroll immediately once data is set
                if (!initialScrollDoneRef.current && processedVerses.length > 0) {
                    const targetIndex = processedVerses.findIndex((v) => v.verseNumber === snapshot.verseNumber);
                    if (targetIndex > 0) {
                        setTimeout(() => {
                            if (!isMounted) return;
                            try {
                                flashListRef.current?.scrollToIndex({ index: targetIndex, animated: false, viewPosition: 0 });
                                initialScrollDoneRef.current = true;
                                hasScrolled.current = true;
                            } catch (e) {}
                        }, 50);
                    } else {
                        initialScrollDoneRef.current = true;
                        hasScrolled.current = true;
                    }
                }
            } catch (error) {
                if (isMounted) console.error('[read-mode] Failed to load:', error);
            }
        };
        load();
        return () => { isMounted = false; };
    }, [snapshot.surahId, snapshot.juzNumber, snapshot.verseNumber, isJuzMode]);

    const toggleWbwMode = useCallback(() => {
        setIsWbwActive(prev => {
            const next = !prev;
            if (!next) {
                // Turning WBW off — clear pill and active card
                setSelectedWbwTranslation(null);
                activeWbwCardKeyRef.current = null;
            }
            return next;
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, []);

    const handleWbwLongPress = useCallback(() => {
        setShowWbwTooltip(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        setTimeout(() => setShowWbwTooltip(false), 2000);
    }, []);

    const handleOpenTafsir = useCallback((surahId: number, verseNumber: number) => {
        setTafsirVerse({ surahId, verseNumber });
        setShowTafsirModal(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, []);

    const initialScrollIndex = React.useMemo(() => {
        if (verses.length === 0) return undefined;
        const targetIndex = verses.findIndex((v) => v.verseNumber === snapshot.verseNumber);
        return targetIndex > 0 ? targetIndex : undefined;
    }, [verses, snapshot.verseNumber]);

    const handleFlashListLoad = useCallback(() => {
        if (initialScrollDoneRef.current || verses.length === 0) return;
        const targetIndex = verses.findIndex((v) => v.verseNumber === snapshot.verseNumber);
        if (targetIndex > 0) {
            scrollTimeoutRef.current = setTimeout(() => {
                try {
                    flashListRef.current?.scrollToIndex({ index: targetIndex, animated: false, viewPosition: 0 });
                    initialScrollDoneRef.current = true;
                    hasScrolled.current = true;
                } catch (e) {}
            }, 60);
        } else {
            initialScrollDoneRef.current = true;
            hasScrolled.current = true;
        }
    }, [verses, snapshot.verseNumber]);

    const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
        const first = viewableItems?.[0]?.item;
        if (!first || !first.verseNumber || !first.surahId) {
            return;
        }

        // Prevent initial mount from overwriting last visible verse before target jump finishes
        if (!initialScrollDoneRef.current && snapshot.verseNumber > 1 && first.verseNumber !== snapshot.verseNumber) {
            return;
        }

        setVisibleSurahId(first.surahId);
        setVisibleVerseNumber(first.verseNumber);
        setVisibleVerseIndex(viewableItems[0]?.index ?? 0);
        hasScrolled.current = true;

        lastVisibleVerseNumberRef.current = first.verseNumber;
        lastVisibleSurahIdRef.current = first.surahId;

        // Record reading activity
        useActivityStore.getState().recordVerseRead(first.surahId, first.verseNumber);

        // BUG FIX: When the topmost visible card changes, clear any stale WBW selection
        // so the pill doesn't get stuck showing a previous word's translation.
        const newKey = `${first.surahId}-${first.verseNumber}`;
        if (activeWbwCardKeyRef.current && activeWbwCardKeyRef.current !== newKey) {
            activeWbwCardKeyRef.current = null;
            setSelectedWbwTranslation(null);
        }
    }, [snapshot.verseNumber]);

    const handleToggleBookmark = useCallback(async (surahId: number, verseNumber: number, verseId: number) => {
        if (bookmarkBusyRef.current) return;
        try {
            bookmarkBusyRef.current = true;
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const bookmarked = bookmarksSet.has(verseId);
            if (!bookmarked) {
                const verse = verses.find((v) => v.id === verseId);
                if (!verse) return;
                await useBookmarkStore.getState().addBookmark(
                    verseId, surahId, snapshot.surahName || `Surah ${surahId}`,
                    verseNumber, verse.arabicText.slice(0, 50), (verse.translation || '').slice(0, 100),
                    isJuzMode ? 'juz' : 'surah', verse.juzNumber
                );
            } else {
                await useBookmarkStore.getState().removeBookmark(verseId);
            }
        } finally {
            bookmarkBusyRef.current = false;
        }
    }, [verses, bookmarksSet, isJuzMode, snapshot.surahName]);

    const handleSurahPlayPause = useCallback(async () => {
        try {
            if (isPlayingSurah) {
                await pauseSurahAudio();
                setIsPlayingSurah(false);
                setIsSurahPaused(true);
            } else {
                await playSurahAudioWithFallback(snapshot.surahId, 1, (status: any) => {
                    if (status?.didJustFinish) setIsPlayingSurah(false);
                    else if (status?.isPlaying) setIsPlayingSurah(true);
                });
                setIsPlayingSurah(true);
            }
        } catch (error) {
            console.error('Audio error:', error);
        }
    }, [snapshot.surahId, isPlayingSurah]);

    const toggleParchmentLightMode = useCallback(() => {
        setReadModeLightTheme(!readModeLightTheme);
    }, [readModeLightTheme, setReadModeLightTheme]);

    const handleToggleFavourite = useCallback(async (surahId: number, verseNumber: number, verseId: number) => {
        if (bookmarkBusyRef.current) return;
        try {
            bookmarkBusyRef.current = true;
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const favourited = isFavourited(verseId);
            if (!favourited) {
                const verse = verses.find((v) => v.id === verseId);
                if (!verse) return;
                await addFavourite(
                    verseId, surahId, snapshot.surahName, verseNumber, 
                    verse.arabicText.slice(0, 50), (verse.translation || '').slice(0, 100), 
                    isJuzMode ? 'juz' : 'surah', verse.juzNumber
                );
            } else {
                await removeFavourite(verseId);
            }
        } finally {
            bookmarkBusyRef.current = false;
        }
    }, [verses, isFavourited, addFavourite, removeFavourite, isJuzMode, snapshot.surahName]);

    // FIX 1: Stable, reusable onSelectWord handler.
    // Previously this was an anonymous arrow function in renderItem, which created a new function
    // reference on every render. Cards holding stale closures would call the wrong handler.
    // Now it's a stable useCallback with the ref accessed at call-time, not captured.
    const handleSelectWord = useCallback((surahId: number, verseNumber: number, translation: string | null) => {
        const cardKey = `${surahId}-${verseNumber}`;
        if (translation === null) {
            // Only clear if this card currently owns the pill — prevents cross-card interference.
            if (activeWbwCardKeyRef.current === cardKey) {
                activeWbwCardKeyRef.current = null;
                setSelectedWbwTranslation(null);
            }
        } else {
            // A word was tapped — this card now takes ownership of the pill.
            activeWbwCardKeyRef.current = cardKey;
            setSelectedWbwTranslation(translation);
        }
    }, []); // Stable: refs and setters never change

    const currentSurahName = getSurahById(visibleSurahId)?.name || snapshot.surahName;
    const headerTitle = isJuzMode
        ? `Juz ${snapshot.juzNumber} · ${currentSurahName}:${visibleVerseNumber}`
        : `${currentSurahName} · ${visibleSurahId}:${visibleVerseNumber}`;

    const themeBG = isParchmentLight ? '#F5F2E9' : '#05080F';
    const themeIconColor = isParchmentLight ? '#8B7355' : "#D4AF37";

    const handleScroll = useCallback((e: any) => {
        if (isTransitioningRef.current || !e?.nativeEvent?.contentSize || !e?.nativeEvent?.layoutMeasurement) return;
        
        const offsetY = e.nativeEvent.contentOffset?.y ?? 0;
        const contentH = e.nativeEvent.contentSize.height;
        const layoutH = e.nativeEvent.layoutMeasurement.height;
        const scrollable = contentH - layoutH;
        
        if (scrollable > 0) {
            let rawProgress = Math.min(1, Math.max(0, offsetY / scrollable));
            
            // Ensure we hit exactly 1.0 when we are at the bottom
            if (offsetY >= scrollable - 2) {
                rawProgress = 1;
            }
            
            let finalProgress = rawProgress;
            
            if (offsetY > lastOffsetYRef.current) {
                // Scrolling down: progress should not decrease
                finalProgress = Math.max(lastProgressRef.current, rawProgress);
            } else if (offsetY < lastOffsetYRef.current) {
                // Scrolling up: progress should not increase
                finalProgress = Math.min(lastProgressRef.current, rawProgress);
            }
            
            lastProgressRef.current = finalProgress;
            lastOffsetYRef.current = offsetY;
            scrollProgressAnim.setValue(finalProgress);
        }
    }, []);

    return (
        <View style={{ flex: 1, width, height, backgroundColor: themeBG, paddingLeft: insets.left, paddingRight: insets.right }}>
            <StatusBar hidden />

            <View style={styles.header}>
                <View style={styles.headerSpacer} />

                <Text style={[styles.headerTitle, isParchmentLight && { color: '#2B2519' }]}>
                    {headerTitle}
                </Text>

                <View style={styles.headerActions}>
                    <View style={styles.tooltipAnchor}>
                        {showWbwTooltip && (
                            <View style={[styles.tooltipContainer, isParchmentLight && { backgroundColor: '#F0EAD6', borderColor: '#D4B483' }]}>
                                <Text style={[styles.tooltipText, isParchmentLight && { color: '#5D4037' }]}>Word by Word</Text>
                            </View>
                        )}
                        <TouchableOpacity 
                            onPress={toggleWbwMode} 
                            onLongPress={handleWbwLongPress}
                            style={styles.iconButton}
                        >
                            <WBWIcon 
                                size={20} 
                                color={isWbwActive ? themeIconColor : (isParchmentLight ? '#8B7355' : '#999')} 
                                isActive={isWbwActive} 
                            />
                        </TouchableOpacity>
                    </View>
                    
                    <TouchableOpacity onPress={handleSurahPlayPause} style={styles.iconButton}>
                        {isPlayingSurah ? <Pause size={20} color={themeIconColor} /> : <Play size={20} color={themeIconColor} />}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={toggleParchmentLightMode} style={styles.iconButton}>
                        <Sun size={20} color={themeIconColor} />
                    </TouchableOpacity>
                </View>
            </View>

            <ReadingProgressBar progress={scrollProgressAnim} isParchmentLight={isParchmentLight} currentVerseIndex={visibleVerseIndex} totalVerses={verses.length} />

            <FlashList
                ref={flashListRef}
                data={verses}
                extraData={communityStatsVersion}
                initialScrollIndex={initialScrollIndex}
                keyExtractor={(item: any) => `${item?.surahId}-${item?.verseNumber}`}
                {...({ estimatedItemSize: 300 } as any)}
                renderItem={({ item }: { item: any }) => {
                    if (!item || !item.surahId || !item.verseNumber) return null;
                    return (
                        <ReadModeVerseCard
                            id={item.id}
                            surahId={item.surahId}
                            surahName={snapshot.surahName}
                            verseNumber={item.verseNumber}
                            pageNumber={item.pageNumber}
                            arabicText={item.arabicText}
                            translation={item.translation || null}
                            transliteration={item.transliteration || null}
                            showTransliteration={showTransliteration}
                            isWbwActive={isWbwActive}
                            translationLanguage={translationLanguage}
                            isParchmentLight={isParchmentLight}
                            onBookmark={(sid, vn) => handleToggleBookmark(sid, vn, item.id)}
                            onTafsir={(sid, vn) => handleOpenTafsir(sid, vn)}
                            onFavorite={(sid, vn) => handleToggleFavourite(sid, vn, item.id)}
                            isBookmarked={bookmarksSet.has(item.id)}
                            isFavorited={isFavourited(item.id)}
                            onSelectWord={(t) => handleSelectWord(item.surahId, item.verseNumber, t)}
                            fontSizeArabic={fontSizeArabic}
                            fontSizeTranslation={fontSizeTranslation}
                            showTranslation={showTranslation}
                        />
                    );
                }}
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onLoad={handleFlashListLoad}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                contentContainerStyle={isParchmentLight 
                    ? { paddingHorizontal: 0, paddingBottom: 80 } 
                    : { paddingHorizontal: 16, paddingBottom: 80 }} 
            />

            <TafsirModal
                visible={showTafsirModal}
                onClose={() => setShowTafsirModal(false)}
                surahId={tafsirVerse?.surahId || 1}
                verseNumber={tafsirVerse?.verseNumber || 1}
                supportedOrientations={['landscape', 'landscape-left', 'landscape-right', 'portrait']}
                forceLightMode={isParchmentLight}
            />

            {selectedWbwTranslation && (
                // BUG FIX: Use 'box-none' so the wrapper is transparent to touches
                // but the pill itself can be tapped to dismiss it.
                <View style={styles.globalDockWrapper} pointerEvents="box-none">
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                            activeWbwCardKeyRef.current = null;
                            setSelectedWbwTranslation(null);
                        }}
                        style={[styles.globalDock, isParchmentLight ? styles.dockLight : styles.dockDark]}
                    >
                        <Text style={[
                            styles.dockText, 
                            isParchmentLight ? { color: '#2C1A0E' } : { color: '#F9E79F' },
                            { fontSize: (fontSizeTranslation || 16) + 2 }
                        ]}>
                            {selectedWbwTranslation}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        zIndex: 10,
    },
    headerSpacer: {
        minWidth: 112,
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        flex: 1,
        fontSize: 15,
        color: '#f4e4b7',
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        textAlign: 'center',
        marginHorizontal: 8,
    },
    headerActions: {
        minWidth: 112,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
    },
    iconButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tooltipAnchor: {
        position: 'relative',
        alignItems: 'center',
    },
    tooltipContainer: {
        position: 'absolute',
        top: 35,
        backgroundColor: '#1A1D23',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#30363D',
        zIndex: 100,
        width: 100,
        alignItems: 'center',
    },
    tooltipText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    globalDockWrapper: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 32,
        zIndex: 9999,
        elevation: 20,
    },
    globalDock: {
        minWidth: 180,
        maxWidth: '85%',
        paddingVertical: 12,
        paddingHorizontal: 28,
        borderRadius: 30,
        borderWidth: 1.5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 10,
    },
    dockDark: {
        backgroundColor: 'rgba(15, 23, 42, 0.98)',
        borderColor: 'rgba(212, 175, 55, 0.8)',
    },
    dockLight: {
        backgroundColor: 'rgba(255, 253, 248, 0.98)',
        borderColor: 'rgba(139, 115, 85, 0.6)',
    },
    dockText: {
        fontWeight: 'bold',
        textAlign: 'center',
        letterSpacing: 0.5,
    }
});