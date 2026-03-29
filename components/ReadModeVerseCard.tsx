import { getTranslationRemote } from '@/services/remoteTranslation';
import { cacheGet, cacheSet } from '@/services/verseCache';
import { useFavouriteStore } from '@/store/favouriteStore';
import { useSettingsStore } from '@/store/settingsStore';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Bookmark, BookOpen, Heart } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import TafsirModal from './TafsirModal';

const IslamicPatternOverlay = () => {
    return (
        <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
            <Defs>
                <Pattern id="islamicPattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                    <Path
                        d="M40,10 L45,25 L60,25 L48,35 L53,50 L40,40 L27,50 L32,35 L20,25 L35,25 Z"
                        fill="#D4AF37"
                        opacity="0.04"
                    />
                </Pattern>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#islamicPattern)" />
        </Svg>
    );
};

const RadialTextGlow = () => {
    return (
        <View style={StyleSheet.absoluteFillObject}>
            <Svg height="100%" width="100%">
                <Defs>
                    <RadialGradient
                        id="radialGlow"
                        cx="50%"
                        cy="50%"
                        rx="50%"
                        ry="50%"
                        fx="50%"
                        fy="50%"
                        gradientUnits="objectBoundingBox"
                    >
                        <Stop offset="0%" stopColor="#D4AF37" stopOpacity="0.12" />
                        <Stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
                    </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#radialGlow)" />
            </Svg>
        </View>
    );
};

interface Props {
    id: number;
    surahId: number;
    surahName: string;
    verseNumber: number;
    juzNumber?: number;
    arabicText: string;
    transliteration?: string;
    translation: string;
    showTransliteration: boolean;
    onBookmark?: (surahId: number, verseNumber: number) => void;
    onTafsir?: (surahId: number, verseNumber: number) => void;
    onFavorite?: (surahId: number, verseNumber: number) => void;
    isBookmarked?: boolean;
    isFavorited?: boolean;
}

export function ReadModeVerseCard({ 
    id,
    surahId, 
    surahName, 
    verseNumber, 
    juzNumber, 
    arabicText, 
    transliteration, 
    translation, 
    showTransliteration,
    onBookmark,
    onTafsir,
    onFavorite,
    isBookmarked = false,
    isFavorited = false 
}: Props) {
    const [arabicTextHeight, setArabicTextHeight] = useState(160);
    const { width } = useWindowDimensions();
    const { showTranslation, translationLanguage, readModeLightTheme } = useSettingsStore();
    const themeColors = {
      readModeParchmentBG: '#F5F2E9',
      readModeParchmentTexture: '#EBE4D0',
      readModeCharcoalText: '#2B2519',
      readModeDeepBG: '#080A10',
      readModeGoldAsset: '#D4AF37',
    };
    const { isFavourited, addFavourite, removeFavourite } = useFavouriteStore();
    const [remoteTranslation, setRemoteTranslation] = useState<string | null>(null);
    const [showTafsirModal, setShowTafsirModal] = useState(false);
    const isMountedRef = useRef(true);

    // Check if this verse is favourited
    const isFav = isFavourited(id);

    // Handle tafsir modal open
    const handleOpenTafsir = useCallback(() => {
        setShowTafsirModal(true);
    }, []);

    // Display translation logic - same as VerseItem
    const displayedTranslation = useMemo(() => {
        return remoteTranslation || translation || '';
    }, [remoteTranslation, translation]);

    // Load remote translation - same as VerseItem
    useEffect(() => {
        const controller = new AbortController();
        isMountedRef.current = true;

        const loadRemoteTranslation = async () => {
            if (!surahId) {
                setRemoteTranslation(null);
                return;
            }

            const langBase = (translationLanguage || '').split('.')[0].toLowerCase();
            if (langBase === 'en') {
                setRemoteTranslation(null);
                return;
            }

            // Debounce remote API calls
            setTimeout(async () => {
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
                } catch (error) {
                    if (!controller.signal.aborted) {
                        console.warn('[ReadModeVerseCard] Remote translation load failed:', error);
                        setRemoteTranslation(null);
                    }
                }
            }, 150); // Debounce remote API calls
        };

        loadRemoteTranslation();

        return () => {
            isMountedRef.current = false;
            controller.abort();
        };
    }, [surahId, verseNumber, translationLanguage]);

    // Determine if parchment light mode is active
    const isParchmentLight = readModeLightTheme;

    const dynamicStyles = StyleSheet.create({
        cardContainer: {
            width: width - 48, // account for horizontal padding
            paddingHorizontal: 0,
            backgroundColor: isParchmentLight ? themeColors.readModeParchmentBG : 'transparent',
            borderRadius: 16,
            overflow: 'hidden',
            alignSelf: 'center',
            ...(isParchmentLight && { marginVertical: 0, marginHorizontal: 0 }),
        },
        arabicContainer: {
            backgroundColor: isParchmentLight ? 'rgba(235, 228, 208, 0.8)' : 'rgba(5, 8, 15, 0.8)',
            paddingHorizontal: 20,
            paddingVertical: 24,
            borderRadius: 12,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: isParchmentLight ? 'rgba(43, 37, 25, 0.2)' : 'rgba(212, 175, 55, 0.2)',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
        },
        arabicText: {
            fontSize: 34,
            lineHeight: Platform.select({
                ios: 56,
                android: 54,
            }),
            color: isParchmentLight ? '#2B2519' : '#F9E79F',
            textAlign: 'center',
            fontFamily: 'KFGQPC-Uthman-Taha',
            writingDirection: 'rtl',
        },
        translation: {
            fontSize: 15,
            lineHeight: 22,
            color: isParchmentLight ? '#3E3627' : '#B0B0B0',
            textAlign: 'center',
            paddingHorizontal: 20,
            fontFamily: 'System',
        },
    });

    return (
        <View style={dynamicStyles.cardContainer}>
            <LinearGradient
                colors={isParchmentLight ? [themeColors.readModeParchmentBG, themeColors.readModeParchmentBG, themeColors.readModeParchmentBG] : ['#05080F', '#111827', '#05080F']}
                style={styles.cardGradient}
            >
                <IslamicPatternOverlay />

                {/* Verse Number Badge */}
                <View style={[
                    styles.badgeContainer,
                    isParchmentLight && { backgroundColor: 'rgba(43, 37, 25, 0.1)' }
                ]}>
                    <Text style={[
                        styles.badgeText,
                        isParchmentLight && { color: '#2B2519' }
                    ]}>
                        {verseNumber}
                    </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtonsContainer}>
                    {onTafsir && (
                        <TouchableOpacity 
                            onPress={handleOpenTafsir}
                            style={styles.actionButton}
                        >
                            <BookOpen size={20} color={isParchmentLight ? '#5C4A3A' : "#888"} />
                        </TouchableOpacity>
                    )}
                    {onBookmark && (
                        <TouchableOpacity 
                            onPress={() => onBookmark(surahId, verseNumber)}
                            style={styles.actionButton}
                        >
                            <Bookmark 
                                size={20} 
                                color={isBookmarked ? (isParchmentLight ? '#8B7355' : "#D4AF37") : (isParchmentLight ? '#5C4A3A' : "#888")} 
                                fill={isBookmarked ? (isParchmentLight ? '#8B7355' : "#D4AF37") : "none"}
                            />
                        </TouchableOpacity>
                    )}
                    {onFavorite && (
                        <TouchableOpacity 
                            onPress={() => onFavorite(surahId, verseNumber)}
                            style={styles.actionButton}
                        >
                            <Heart 
                                size={20} 
                                color={isFavorited ? "#FF4B6E" : (isParchmentLight ? '#5C4A3A' : "#888")} 
                                fill={isFavorited ? "#FF4B6E" : "none"}
                            />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Main Content Area */}
                <View style={[styles.mainContent]}>
                    <View style={dynamicStyles.arabicContainer}>
                        <RadialTextGlow />

                        {/* Ornaments */}
                        <Text style={[styles.cornerOrnament, { top: 8, left: 8 }]}>✦</Text>
                        <Text style={[styles.cornerOrnament, { top: 8, right: 8 }]}>✦</Text>
                        <Text style={[styles.cornerOrnament, { bottom: 8, left: 8 }]}>✦</Text>
                        <Text style={[styles.cornerOrnament, { bottom: 8, right: 8 }]}>✦</Text>

                        {/* Arabic Text - Conditional rendering for light/dark mode */}
                        {isParchmentLight ? (
                            <View
                                style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}
                                onLayout={(e) => {
                                    const measuredHeight = e.nativeEvent.layout.height;
                                    if (measuredHeight > 0) {
                                        setArabicTextHeight(Math.max(measuredHeight + 10, 160));
                                    }
                                }}
                            >
                                <Text
                                    style={dynamicStyles.arabicText}
                                    allowFontScaling={false}
                                >
                                    {arabicText}
                                </Text>
                                {showTransliteration && transliteration && (
                                    <Text style={dynamicStyles.translation}>
                                        {transliteration}
                                    </Text>
                                )}
                                {showTranslation && displayedTranslation && (
                                    <Text style={dynamicStyles.translation}>
                                        {displayedTranslation}
                                    </Text>
                                )}
                            </View>
                        ) : (
                            <MaskedView
                                style={{ width: '100%', height: arabicTextHeight }}
                                maskElement={
                                    <View
                                        style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}
                                        onLayout={(e) => {
                                            const measuredHeight = e.nativeEvent.layout.height;
                                            if (measuredHeight > 0) {
                                                setArabicTextHeight(Math.max(measuredHeight + 10, 160));
                                            }
                                        }}
                                    >
                                        <Text
                                            style={dynamicStyles.arabicText}
                                            allowFontScaling={false}
                                        >
                                            {arabicText}
                                        </Text>
                                        {showTransliteration && transliteration && (
                                            <Text style={styles.transliteration}>
                                                {transliteration}
                                            </Text>
                                        )}
                                        {showTranslation && displayedTranslation && (
                                            <Text style={styles.translation}>
                                                {displayedTranslation}
                                            </Text>
                                        )}
                                    </View>
                                }
                            >
                                <LinearGradient
                                    colors={['#B8860B', '#F9E79F', '#D4AF37', '#B8860B']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={StyleSheet.absoluteFill}
                                />
                            </MaskedView>
                        )}
                    </View>
                </View>
            </LinearGradient>

            <TafsirModal
                visible={showTafsirModal}
                onClose={() => setShowTafsirModal(false)}
                surahId={surahId}
                verseNumber={verseNumber}
                supportedOrientations={['landscape', 'landscape-left', 'landscape-right', 'portrait']}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    cardGradient: {
        padding: 24,
        borderRadius: 16,
        position: 'relative',
        overflow: 'hidden',
    },
    badgeContainer: {
        position: 'absolute',
        top: 24,
        left: 24,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        borderRadius: 20, // pill shape
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.5)',
        zIndex: 10,
    },
    badgeText: {
        color: '#D4AF37',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    mainContent: {
        flex: 1,
        marginTop: 40, // Space for the floating verse badge
        justifyContent: 'center',
    },
    arabicContainer: {
        backgroundColor: 'rgba(5, 8, 15, 0.8)',
        paddingHorizontal: 20,
        paddingVertical: 24,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    cornerOrnament: {
        position: 'absolute',
        color: '#D4AF37',
        opacity: 0.5,
        fontSize: 12,
        zIndex: 5,
    },
    arabicText: {
        fontSize: 34,
        lineHeight: Platform.select({
            ios: 56,
            android: 54,
        }),
        color: '#F9E79F',
        textAlign: 'center',
        fontFamily: 'KFGQPC-Uthman-Taha',
        writingDirection: 'rtl',
        backgroundColor: 'transparent',
    },
    translationContainer: {
        marginTop: 16,
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: 'rgba(212, 175, 55, 0.08)',
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: 'rgba(212, 175, 55, 0.6)',
        opacity: 0.95,
    },
    transliteration: {
        fontSize: 14,
        color: '#94A3B8',
        marginTop: 8,
        marginBottom: 4,
        fontStyle: 'italic',
        textAlign: 'center',
    },
    translation: {
        fontSize: 16,
        color: '#f4e4b7',
        lineHeight: 24,
        fontFamily: Platform.OS === 'ios' ? 'EB Garamond' : 'serif',
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 4,
    },
    actionButtonsContainer: {
        position: 'absolute',
        top: 24,
        right: 24,
        flexDirection: 'row',
        gap: 8,
        zIndex: 10,
    },
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
