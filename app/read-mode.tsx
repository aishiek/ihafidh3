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
import { fetchVersesForJuz } from '../services/juzDbService';
import { getVersesBySurah } from '../data/verses';
import { useBookmarkStore } from '../store/bookmarkStore';
import { useFavouriteStore } from '../store/favouriteStore';
import { useReadModeStore } from '../store/readModeStore';
import { useSettingsStore } from '../store/settingsStore';
import { Verse } from '../types/verse';
import { pauseSurahAudio, playSurahAudioWithFallback } from '../utils/audioUtils';

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

    const [isWbwActive, setIsWbwActive] = useState(false);

    const snapshot = useRef(parseSnapshot(params)).current;
    const isJuzMode = snapshot.source === 'juzList' && !!snapshot.juzNumber;

    const [verses, setVerses] = useState<Verse[]>([]);
    const [visibleVerseNumber, setVisibleVerseNumber] = useState(snapshot.verseNumber);
    const [showTafsirModal, setShowTafsirModal] = useState(false);
    const [tafsirVerse, setTafsirVerse] = useState<{ surahId: number; verseNumber: number } | null>(null);
    const [isPlayingSurah, setIsPlayingSurah] = useState(false);
    const [isSurahPaused, setIsSurahPaused] = useState(false);
    const [scrollProgress, setScrollProgress] = useState(0);

    const flashListRef = useRef<FlashListRef<Verse>>(null);
    const hasScrolled = useRef(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const bookmarkBusyRef = useRef(false);
    const isExiting = useRef(false);

    const lastVisibleVerseNumberRef = useRef(snapshot.verseNumber);
    const lastVisibleSurahIdRef = useRef(snapshot.surahId);
    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

    const [showWbwTooltip, setShowWbwTooltip] = useState(false);
    const [selectedWbwTranslation, setSelectedWbwTranslation] = useState<string | null>(null);
    // Tracks which verse card currently owns the WBW pill (surahId-verseNumber)
    const activeWbwCardKeyRef = useRef<string | null>(null);
    const bookmarksSet = useBookmarkStore((state) => state.bookmarksSet);
    const { isFavourited, addFavourite, removeFavourite } = useFavouriteStore();

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
        // Pushing to the tab again can trigger a reset/flicker. 
        // back() is more stable as it keeps the existing Tab instance alive.
        if (router.canGoBack()) {
            router.back();
        } else {
            // Fallback for edge cases
            router.replace('/(tabs)/read');
        }
    }, [isJuzMode, snapshot.juzNumber, router, snapshot.source]);

    useEffect(() => {
        isExiting.current = false;

        // Suppress portrait-return events briefly during any lock/unlock cycle
        let isInitialLockCycle = true;

        // ANDROID DOUBLE-ROTATION FIX: Check actual orientation before locking.
        // The user rotated to landscape to get here — locking to LANDSCAPE_LEFT when
        // the device is in LANDSCAPE_RIGHT causes Android to visually rotate twice
        // (RIGHT → LEFT → unlock → settle). Instead, only lock if we're not already
        // in a landscape orientation (handles edge case of programmatic navigation).
        const initOrientation = async () => {
            try {
                const current = await ScreenOrientation.getOrientationAsync();
                const alreadyLandscape =
                    current === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
                    current === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;

                if (!alreadyLandscape) {
                    // Coming from portrait (programmatic open) — lock to landscape
                    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT).catch(() => {
                        return ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
                    });
                    // Short delay before unlock so the lock settles
                    await new Promise(resolve => setTimeout(resolve, 600));
                    await ScreenOrientation.unlockAsync().catch(() => {});
                }
                // If already in landscape: no lock needed — just open to interaction
            } catch {
                // Fallback: unlock only, don't lock
                ScreenOrientation.unlockAsync().catch(() => {});
            } finally {
                isInitialLockCycle = false;
            }
        };

        initOrientation();

        const subscription = ScreenOrientation.addOrientationChangeListener((evt) => {
            // Ignore events during the initial lock/unlock cycle
            if (isInitialLockCycle) return;
            const orientation = evt.orientationInfo.orientation;
            if (
                orientation === ScreenOrientation.Orientation.PORTRAIT_UP ||
                orientation === ScreenOrientation.Orientation.PORTRAIT_DOWN
            ) {
                handlePortraitReturn();
            }
        });

        // Hide stale WBW pill on mount
        setSelectedWbwTranslation(null);

        return () => {
            subscription.remove();
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
            // FIX 2: Pause any playing audio when leaving Read Mode
            pauseSurahAudio().catch(() => {});
            // Restore portrait lock then release
            // Delay portrait lock until after navigation animation completes
            setTimeout(() => {
                ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
                    .then(() => setTimeout(() => ScreenOrientation.unlockAsync().catch(() => {}), 500))
                    .catch(() => {});
            }, 350); // matches fade animation duration
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
                setVerses(processedVerses);
            } catch (error) {
                console.error('[read-mode] Failed to load:', error);
            }
        };
        load();
    }, [snapshot.surahId, snapshot.juzNumber, isJuzMode]);

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

    const handleFlashListLoad = useCallback(() => {
        if (hasScrolled.current || verses.length === 0) return;
        const targetIndex = verses.findIndex((v) => v.verseNumber === snapshot.verseNumber);
        if (targetIndex >= 0) {
            scrollTimeoutRef.current = setTimeout(() => {
                flashListRef.current?.scrollToIndex({ index: targetIndex, animated: false, viewPosition: 0.5 });
                hasScrolled.current = true;
            }, 100);
        } else {
            hasScrolled.current = true;
        }
    }, [verses, snapshot.verseNumber]);

    const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
        const first = viewableItems[0]?.item as Verse | undefined;
        if (!first) return;
        setVisibleVerseNumber(first.verseNumber);
        lastVisibleVerseNumberRef.current = first.verseNumber;
        lastVisibleSurahIdRef.current = first.surahId;

        // BUG FIX: When the topmost visible card changes, clear any stale WBW selection
        // so the pill doesn't get stuck showing a previous word's translation.
        const newKey = `${first.surahId}-${first.verseNumber}`;
        if (activeWbwCardKeyRef.current && activeWbwCardKeyRef.current !== newKey) {
            activeWbwCardKeyRef.current = null;
            setSelectedWbwTranslation(null);
        }
    }, []);

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

    const headerTitle = isJuzMode
        ? `Juz ${snapshot.juzNumber} · ${snapshot.surahName}:${visibleVerseNumber}`
        : `${snapshot.surahName} · ${snapshot.surahId}:${visibleVerseNumber}`;

    const themeBG = isParchmentLight ? '#F5F2E9' : '#05080F';
    const themeIconColor = isParchmentLight ? '#8B7355' : "#D4AF37";

    const handleScroll = useCallback((e: any) => {
        const offsetY      = e.nativeEvent.contentOffset.y;
        const contentH     = e.nativeEvent.contentSize.height;
        const layoutH      = e.nativeEvent.layoutMeasurement.height;
        const scrollable   = contentH - layoutH;
        const progress     = scrollable > 0 ? Math.min(Math.max(offsetY / scrollable, 0), 1) : 0;
        setScrollProgress(progress);
    }, []);

    return (
        <View style={{ flex: 1, width, height, backgroundColor: themeBG, paddingLeft: insets.left, paddingRight: insets.right }}>
            <StatusBar hidden />

            <View style={styles.header}>

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

            <ReadingProgressBar progress={scrollProgress} isParchmentLight={isParchmentLight} />

            <FlashList
                ref={flashListRef}
                data={verses}
                keyExtractor={(item) => `${item.surahId}-${item.verseNumber}`}
                renderItem={({ item }) => (
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
                )}
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
    headerTitle: {
        flex: 1,
        fontSize: 15,
        color: '#f4e4b7',
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        textAlign: 'center',
        marginHorizontal: 8,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
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