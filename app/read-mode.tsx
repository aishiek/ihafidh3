/**
 * ReadModeScreen.tsx
 * Updated with Syntax Fixes and Parchment Mode support
 */

import type { FlashListRef } from '@shopify/flash-list';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { ArrowLeft, Pause, Play, Sun } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { fetchVersesForJuz, fetchVersesForSurah } from '../services/juzDbService';
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
    const { showTransliteration, readModeLightTheme, setReadModeLightTheme } = useSettingsStore();
    const isParchmentLight = readModeLightTheme;

    const snapshot = useRef(parseSnapshot(params)).current;
    const isJuzMode = snapshot.source === 'juzList' && !!snapshot.juzNumber;

    const [verses, setVerses] = useState<Verse[]>([]);
    const [visibleVerseNumber, setVisibleVerseNumber] = useState(snapshot.verseNumber);
    const [showTafsirModal, setShowTafsirModal] = useState(false);
    const [isPlayingSurah, setIsPlayingSurah] = useState(false);
    const [isSurahPaused, setIsSurahPaused] = useState(false);

    const flashListRef = useRef<FlashListRef<Verse>>(null);
    const hasScrolled = useRef(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const bookmarkBusyRef = useRef(false);
    const isExiting = useRef(false);

    const lastVisibleVerseNumberRef = useRef(snapshot.verseNumber);
    const lastVisibleSurahIdRef = useRef(snapshot.surahId);
    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

    const bookmarksSet = useBookmarkStore((state) => state.bookmarksSet);
    const { isFavourited, addFavourite, removeFavourite } = useFavouriteStore();

    const handlePortraitReturn = useCallback(() => {
        if (isExiting.current) return;
        isExiting.current = true;

        useReadModeStore.getState().setLastVisibleVerse(
            lastVisibleSurahIdRef.current,
            lastVisibleVerseNumberRef.current,
        );

        if (isJuzMode && snapshot.juzNumber) {
            useReadModeStore.getState().setLastVisibleJuz(snapshot.juzNumber);
        }

        router.push({
            pathname: '/(tabs)/read',
            params: {
                surahId: lastVisibleSurahIdRef.current.toString(),
                verseId: lastVisibleVerseNumberRef.current.toString(),
                source: snapshot.source,
                scrollVerse: lastVisibleVerseNumberRef.current.toString(),
            }
        } as any);
    }, [isJuzMode, snapshot.juzNumber, router, snapshot.source]);

    useEffect(() => {
        isExiting.current = false;
        
        // Force landscape mode more reliably
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT).catch((error) => {
            console.warn('[read-mode] Failed to lock to landscape left:', error);
            // Fallback to general landscape
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(console.error);
        });

        // Increase unlock timer to ensure landscape is established
        const unlockTimer = setTimeout(() => {
            ScreenOrientation.unlockAsync().catch(console.error);
        }, 1500);

        const subscription = ScreenOrientation.addOrientationChangeListener((evt) => {
            const orientation = evt.orientationInfo.orientation;
            if (orientation === ScreenOrientation.Orientation.PORTRAIT_UP || orientation === ScreenOrientation.Orientation.PORTRAIT_DOWN) {
                handlePortraitReturn();
            }
        });

        return () => {
            clearTimeout(unlockTimer);
            subscription.remove();
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(console.error);
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
                let rawVerses: any[];
                if (isJuzMode && snapshot.juzNumber) {
                    rawVerses = await fetchVersesForJuz(snapshot.juzNumber);
                } else {
                    rawVerses = await fetchVersesForSurah(snapshot.surahId);
                }

                const mapped: Verse[] = rawVerses.map((jv) => ({
                    id: jv.verse_id,
                    surahId: jv.chapter_id,
                    verseNumber: jv.verse_number,
                    arabicText: jv.ayah,
                    translation: jv.translation || '',
                    juzNumber: jv.part_id,
                    transliteration: jv.transliteration,
                }));
                setVerses(mapped);
            } catch (error) {
                console.error('[read-mode] Failed to load:', error);
            }
        };
        load();
    }, [snapshot.surahId, snapshot.juzNumber, isJuzMode]);

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
        useReadModeStore.getState().setLastVisibleVerse(first.surahId, first.verseNumber);
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

    const handleOpenTafsir = useCallback((surahId: number, verseNumber: number) => {
        setShowTafsirModal(true);
    }, []);

    const handleToggleFavourite = useCallback(async (surahId: number, verseNumber: number, verseId: number) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (isFavourited(verseId)) {
            removeFavourite(verseId);
        } else {
            const verse = verses.find((v) => v.id === verseId);
            if (verse) {
                addFavourite(verseId, surahId, snapshot.surahName, verseNumber, verse.arabicText.slice(0, 50), (verse.translation || '').slice(0, 100), isJuzMode ? 'juz' : 'surah', verse.juzNumber);
            }
        }
    }, [verses, isFavourited, addFavourite, removeFavourite, isJuzMode, snapshot.surahName]);

    const headerTitle = isJuzMode
        ? `Juz ${snapshot.juzNumber} · ${snapshot.surahName} ${snapshot.surahId}:${visibleVerseNumber}`
        : `${snapshot.surahName} · ${snapshot.surahId}:${visibleVerseNumber}`;

    const themeBG = isParchmentLight ? '#F5F2E9' : '#05080F';
    const themeIconColor = isParchmentLight ? '#8B7355' : "#D4AF37";

    return (
        <View style={{ flex: 1, width, height, backgroundColor: themeBG }}>
            <StatusBar hidden />

            <View style={styles.header}>
                <TouchableOpacity onPress={handlePortraitReturn} style={styles.backButton}>
                    <ArrowLeft size={24} color={themeIconColor} />
                </TouchableOpacity>

                <Text style={[styles.headerTitle, isParchmentLight && { color: '#2B2519' }]}>
                    {headerTitle}
                </Text>

                <View style={styles.placeholderIcons}>
                    <TouchableOpacity onPress={handleSurahPlayPause} style={styles.iconButton}>
                        {isPlayingSurah ? <Pause size={20} color={themeIconColor} /> : <Play size={20} color={themeIconColor} />}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={toggleParchmentLightMode} style={styles.iconButton}>
                        <Sun size={20} color={themeIconColor} />
                    </TouchableOpacity>
                </View>
            </View>

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
                        arabicText={item.arabicText}
                        translation={item.translation}
                        transliteration={item.transliteration}
                        showTransliteration={showTransliteration}
                        onBookmark={(sid, vn) => handleToggleBookmark(sid, vn, item.id)}
                        onTafsir={(sid, vn) => handleOpenTafsir(sid, vn)}
                        onFavorite={(sid, vn) => handleToggleFavourite(sid, vn, item.id)}
                        isBookmarked={bookmarksSet.has(item.id)}
                        isFavorited={isFavourited(item.id)}
                    />
                )}
                showsVerticalScrollIndicator={false}
                onLoad={handleFlashListLoad}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
            />

            <View style={styles.bottomNavigation} pointerEvents="none">
                <Text style={styles.progressText}>
                    {visibleVerseNumber} / {verses.length}
                </Text>
            </View>
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
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
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
    placeholderIcons: {
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
    bottomNavigation: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.5)',
    },
    progressText: {
        color: '#D4AF37',
        fontSize: 14,
        fontWeight: '600',
    },
});