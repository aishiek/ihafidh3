/**
 * ReadModeVerseCard.tsx
 * Production-ready interaction logic: 
 * 1. Prevents selection clobbering by reporting only on explicit user taps.
 * 2. Suppresses interactive elements when WBW mode is off.
 * 3. Streamlined 12:1 format for verse references.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { BookOpen, Bookmark, Heart } from 'lucide-react-native';
import { getWBWForVerse, WBWWord } from '../services/wbwDbService';
import { getTranslationRemote } from '../services/remoteTranslation';
import { cacheGet, cacheSet } from '../services/verseCache';

/** True if token contains a Quranic base letter (excludes waqf ۚ, comma, tatweel-only, etc.). */
function tokenHasQuranicBaseLetter(token: string): boolean {
    // Core Arabic letters + common Uthmani supplements (e.g. ٱ U+0671); not Arabic block punctuation/waqf.
    return /[\u0621-\u063A\u0641-\u064A\u0671\u06CC\u06D2\u06D5]/.test(token);
}

type ArabicDisplaySegment =
    | { kind: 'word'; text: string; wbwIndex: number }
    | { kind: 'punct'; text: string };

function segmentArabicForWbw(arabicText: string): ArabicDisplaySegment[] {
    const normalized = arabicText.replace(/\s+/g, ' ').trim();
    if (!normalized) return [];
    const parts = normalized.split(' ');
    const out: ArabicDisplaySegment[] = [];
    let wbwIndex = 0;
    for (const raw of parts) {
        const p = raw.trim();
        if (!p) continue;
        if (tokenHasQuranicBaseLetter(p)) {
            out.push({ kind: 'word', text: p, wbwIndex: wbwIndex++ });
        } else {
            out.push({ kind: 'punct', text: p });
        }
    }
    return out;
}

interface ReadModeVerseCardProps {
    id: number;
    surahId: number;
    surahName: string;
    verseNumber: number;
    arabicText: string;
    translation: string | null;
    transliteration: string | null;
    showTransliteration: boolean;
    isWbwActive: boolean;
    translationLanguage: string;
    isParchmentLight: boolean;
    onBookmark: (surahId: number, verseNumber: number) => void;
    onTafsir: (surahId: number, verseNumber: number) => void;
    onFavorite: (surahId: number, verseNumber: number) => void;
    isBookmarked: boolean;
    isFavorited: boolean;
    onSelectWord?: (translation: string | null) => void;
    fontSizeArabic?: number;
    fontSizeTranslation?: number;
    showTranslation?: boolean;
}

export function ReadModeVerseCard({
    id,
    surahId,
    verseNumber,
    arabicText,
    translation,
    isWbwActive,
    translationLanguage,
    isParchmentLight,
    onBookmark,
    onTafsir,
    onFavorite,
    isBookmarked,
    isFavorited,
    onSelectWord,
    fontSizeArabic = 34,
    fontSizeTranslation = 18,
    showTranslation = true,
}: ReadModeVerseCardProps) {
    const [selectedDotIndex, setSelectedDotIndex] = useState<number | null>(null);
    const [wbwData, setWbwData] = useState<WBWWord[]>([]);
    const [remoteTranslation, setRemoteTranslation] = useState<string | null>(null);
    const translationAbortRef = useRef<AbortController | null>(null);
    const isMountedRef = useRef(true);

    // 1. Load WBW data from DB
    useEffect(() => {
        let isMounted = true;
        const loadWbw = async () => {
            try {
                const data = await getWBWForVerse(surahId, verseNumber);
                if (isMounted) {
                    setWbwData(data);
                }
            } catch (err) {
                console.error('[VerseCard] WBW Load error:', err);
            }
        };
        loadWbw();
        return () => { isMounted = false; };
    }, [surahId, verseNumber]);

    // Non-English full-verse translation (same flow as VerseItem.tsx)
    useEffect(() => {
        setRemoteTranslation(null);
        translationAbortRef.current?.abort();

        if (!showTranslation || !surahId) {
            return;
        }

        const langBase = (translationLanguage || '').split('.')[0].toLowerCase();
        if (langBase === 'en') {
            return;
        }

        isMountedRef.current = true;
        const controller = new AbortController();
        translationAbortRef.current = controller;

        const timeoutId = setTimeout(async () => {
            if (!isMountedRef.current || controller.signal.aborted) return;
            try {
                const cached = cacheGet<string>(surahId, verseNumber, translationLanguage);
                if (cached) {
                    if (isMountedRef.current && !controller.signal.aborted) {
                        setRemoteTranslation(cached);
                    }
                    return;
                }
                const remote = await getTranslationRemote(surahId, verseNumber, translationLanguage);
                if (isMountedRef.current && !controller.signal.aborted && remote) {
                    setRemoteTranslation(remote);
                    cacheSet(surahId, verseNumber, translationLanguage, remote);
                }
            } catch {
                if (!controller.signal.aborted && isMountedRef.current) {
                    setRemoteTranslation(null);
                }
            }
        }, 150);

        return () => {
            clearTimeout(timeoutId);
            isMountedRef.current = false;
            controller.abort();
        };
    }, [surahId, verseNumber, translationLanguage, showTranslation]);

    const displayedTranslation = useMemo(() => {
        const langBase = (translationLanguage || '').split('.')[0].toLowerCase();
        const local = translation?.trim() ? translation : null;
        if (langBase === 'en') {
            return local;
        }
        return remoteTranslation || local;
    }, [translationLanguage, translation, remoteTranslation]);

    useEffect(() => {
        // BUG FIX: When the card is recycled by FlashList for a new verse, or WBW
        // is toggled off, we must reset local selection AND notify the parent so
        // the pill doesn't get stuck showing a stale translation.
        if (selectedDotIndex !== null) {
            setSelectedDotIndex(null);
            onSelectWord?.(null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [surahId, verseNumber]);

    // Clear selection when WBW mode is toggled off globally
    useEffect(() => {
        if (!isWbwActive && selectedDotIndex !== null) {
            setSelectedDotIndex(null);
            // Don't notify parent here — parent handles it when toggling off
        }
    }, [isWbwActive]);

    const handleWordPress = useCallback((wbwIndex: number) => {
        if (!isWbwActive) return;

        const isDeselecting = selectedDotIndex === wbwIndex;
        const newIndex = isDeselecting ? null : wbwIndex;
        setSelectedDotIndex(newIndex);

        // Notify parent immediately on tap (Production Fix: Moving from useEffect to tap handler)
        if (onSelectWord) {
            if (newIndex === null) {
                onSelectWord(null);
            } else {
                const word = wbwData[wbwIndex];
                if (word) {
                    const primaryCode = (translationLanguage || '').split('.')[0].toLowerCase();
                    let t = '';
                    if (primaryCode === 'ta') t = word.ta;
                    else if (primaryCode === 'id') t = word.id;
                    else if (primaryCode === 'ms') t = word.ms;
                    else t = word.en;

                    // WBW DB has partial coverage per language; empty cells fall back (see assets/database/wbw_translations.db).
                    if (!t) t = word.en || word.id || word.ta || word.ms || '...';
                    onSelectWord(t);
                }
            }
        }
    }, [selectedDotIndex, isWbwActive, onSelectWord, wbwData, translationLanguage]);

    const themeIconColor = isParchmentLight ? '#8B7355' : "#D4AF37";
    const themeTextColor = isParchmentLight ? '#5D4037' : '#F9E79F';
    
    // Dynamic styles based on settings
    const boostedArabicSize = fontSizeArabic + 10;
    const boostedTranslationSize = fontSizeTranslation + 2;

    const displaySegments = useMemo(() => segmentArabicForWbw(arabicText), [arabicText]);

    return (
        <View style={styles.cardContainer}>
            {/* Improved Header: Surah:Verse format only */}
            <View style={styles.verseHeader}>
                <View style={styles.referenceBadge}>
                    <Text style={[styles.referenceText, isParchmentLight && { color: '#5D4037' }]}>
                        {surahId}:{verseNumber}
                    </Text>
                </View>
                <View style={styles.actions}>
                    <TouchableOpacity onPress={() => onTafsir(surahId, verseNumber)} style={styles.actionButton}>
                        <BookOpen size={20} color={themeIconColor} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onBookmark(surahId, verseNumber)} style={styles.actionButton}>
                        <Bookmark size={20} color={isBookmarked ? themeIconColor : (isParchmentLight ? '#A1887F' : '#666')} fill={isBookmarked ? themeIconColor : 'transparent'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onFavorite(surahId, verseNumber)} style={styles.actionButton}>
                        <Heart size={20} color={isFavorited ? '#E91E63' : themeIconColor} fill={isFavorited ? '#E91E63' : 'transparent'} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.verseBody}>
                <View style={styles.wordsContainer}>
                    {displaySegments.map((seg, index) => {
                        if (seg.kind === 'punct') {
                            return (
                                <View key={`p-${index}-${seg.text}`} style={styles.punctWrapper}>
                                    <Text
                                        style={[
                                            styles.punctText,
                                            { fontSize: boostedArabicSize, lineHeight: boostedArabicSize * 1.6, color: themeTextColor },
                                        ]}
                                        allowFontScaling={false}
                                    >
                                        {seg.text}
                                    </Text>
                                </View>
                            );
                        }

                        const isSelected = selectedDotIndex === seg.wbwIndex;
                        const word = seg.text;
                        return (
                            <TouchableOpacity
                                key={`w-${seg.wbwIndex}-${word}`}
                                activeOpacity={isWbwActive ? 0.8 : 1.0}
                                onPress={() => handleWordPress(seg.wbwIndex)}
                                style={styles.wordWrapper}
                            >
                                {/* Only show highlight if WBW mode is explicitly ON */}
                                {isWbwActive && isSelected && (
                                    <View style={[
                                        styles.wordHighlight,
                                        isParchmentLight ? styles.wordHighlightLight : styles.wordHighlightDark
                                    ]} />
                                )}

                                <MaskedView
                                    maskElement={
                                        <Text
                                            style={[
                                                styles.arabicTextMask,
                                                { fontSize: boostedArabicSize, lineHeight: boostedArabicSize * 1.6 }
                                            ]}
                                            allowFontScaling={false}
                                        >
                                            {word}
                                        </Text>
                                    }
                                >
                                    <LinearGradient
                                        colors={isParchmentLight ? ['#5D4037', '#2C1A0E'] : ['#F4E4B7', '#D4AF37', '#B8860B']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={[styles.gradient, { height: boostedArabicSize * 1.8 }]}
                                    >
                                        <Text style={[styles.arabicTextGhost, { fontSize: boostedArabicSize }]}>{word}</Text>
                                    </LinearGradient>
                                </MaskedView>

                                {/* Only show dots if WBW mode is explicitly ON */}
                                {isWbwActive && (
                                    <View style={[
                                        styles.dot,
                                        isSelected && styles.dotSelected,
                                        isParchmentLight ? styles.dotLight : styles.dotDark,
                                        isSelected && isParchmentLight && styles.dotSelectedLight
                                    ]} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {showTranslation && displayedTranslation ? (
                    <View style={styles.translationContainer}>
                        <Text style={[
                            styles.translationText, 
                            { color: themeTextColor, fontSize: boostedTranslationSize },
                            isParchmentLight && { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }
                        ]}>
                            {displayedTranslation}
                        </Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.footer}>
                <LinearGradient
                    colors={isParchmentLight ? ['transparent', '#D4B483', 'transparent'] : ['transparent', '#D4AF37', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.divider}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    cardContainer: {
        marginBottom: 40,
        paddingHorizontal: 24,
    },
    verseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    referenceBadge: {
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 0.5,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    referenceText: {
        fontSize: 12,
        color: '#D4AF37',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    actions: {
        flexDirection: 'row',
        gap: 16,
    },
    actionButton: {
        padding: 4,
    },
    verseBody: {
        alignItems: 'center',
    },
    wordsContainer: {
        flexDirection: 'row-reverse',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    wordWrapper: {
        paddingHorizontal: 6,
        marginVertical: 4,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    punctWrapper: {
        paddingHorizontal: 2,
        marginVertical: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    punctText: {
        fontFamily: Platform.OS === 'android' ? 'KFGQPC_Hafs' : 'KFGQPC Uthman Taha Naskh',
        textAlign: 'center',
        opacity: 0.92,
    },
    wordHighlight: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        borderRadius: 8,
    },
    wordHighlightDark: {
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
    },
    wordHighlightLight: {
        backgroundColor: 'rgba(139, 115, 85, 0.12)',
    },
    arabicTextMask: {
        fontFamily: Platform.OS === 'android' ? 'KFGQPC_Hafs' : 'KFGQPC Uthman Taha Naskh',
        textAlign: 'center',
        backgroundColor: 'transparent',
    },
    arabicTextGhost: {
        opacity: 0,
        fontFamily: Platform.OS === 'android' ? 'KFGQPC_Hafs' : 'KFGQPC Uthman Taha Naskh',
    },
    gradient: {
        justifyContent: 'center',
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginTop: 6,
    },
    dotDark: {
        backgroundColor: 'rgba(212, 175, 55, 0.55)',
    },
    dotLight: {
        backgroundColor: 'rgba(139, 115, 85, 0.6)',
    },
    dotSelected: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#D4AF37',
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 6,
    },
    dotSelectedLight: {
        backgroundColor: '#8B7355',
        shadowColor: '#8B7355',
    },
    translationContainer: {
        marginTop: 10,
        width: '100%',
    },
    translationText: {
        textAlign: 'center',
        lineHeight: 28,
        fontStyle: 'italic',
        opacity: 0.85,
    },
    footer: {
        marginTop: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    divider: {
        width: '60%',
        height: 1,
        opacity: 0.3,
    },
});