import { logAnalyticsEvent } from '@/utils/analyticsHelper';
import { useThemeColor } from '@/utils/useThemeColor';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, Play, RefreshCw, Share2, Star } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, PixelRatio, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Share from 'react-native-share';
import Svg, { Defs, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';

// Islamic Geometric Pattern Overlay - Subtle texture for premium feel
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

// Radial Glow for depth behind text
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

// Branded Footer Component for Share Image
const BrandedFooter = () => {
    const openPlayStore = async () => {
        const intent = 'market://details?id=com.ihafidh';
        const web = 'https://play.google.com/store/apps/details?id=com.ihafidh';
        try { await Linking.openURL(intent); } catch { await Linking.openURL(web); }
    };
    const openAppStore = async () => {
        const url = 'https://apps.apple.com/sg/app/ihafidh/id6752505055';
        try { await Linking.openURL(url); } catch { }
    };
    return (
        <View style={styles.brandedFooter}>
            {/* Subtle top border accent */}
            <LinearGradient
                colors={['#D4AF3740', 'transparent', '#D4AF3740']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.footerTopAccent}
            />

            <View style={styles.footerContent}>
                {/* App Icon with glow */}
                <View style={styles.appIconWrapper}>
                    <View style={styles.appIconGlow} />
                    <View style={styles.appIconContainer}>
                        <Image
                            source={require('@/assets/images/icon.png')}
                            style={styles.appIcon}
                            resizeMode="contain"
                        />
                    </View>
                </View>

                {/* Brand Info */}
                <View style={styles.brandInfoContainer}>
                    <View style={styles.brandTextContainer}>
                        <Text style={styles.appName}>iHafidh</Text>
                        <Text style={styles.appTagline}>Your Quran Companion</Text>
                    </View>

                    {/* Store Badges */}
                    <View style={styles.compactBadgesRow}>
                        <Text style={styles.downloadText}>Download:</Text>
                        <Pressable onPress={openAppStore} style={styles.compactStoreBadge} hitSlop={4}>
                            <Image
                                source={require('@/assets/images/appstore.png')}
                                style={styles.compactBadgeImage}
                                resizeMode="contain"
                            />
                        </Pressable>
                        <Pressable onPress={openPlayStore} style={styles.compactStoreBadge} hitSlop={4}>
                            <Image
                                source={require('@/assets/images/playstore.png')}
                                style={styles.compactBadgeImage}
                                resizeMode="contain"
                            />
                        </Pressable>
                    </View>
                </View>
            </View>
        </View>
    );
};

interface DetailedDuaCardProps {
    dua: any;
    verseData: any; // Full verse data from DB
    status: 'new' | 'memorized' | 'revised' | 'perfect';
    onPress: () => void;
    onPlayAudio?: () => void;
    theme: any;
}

export function DetailedDuaCard({
    dua,
    verseData,
    status,
    onPress,
    onPlayAudio,
    theme
}: DetailedDuaCardProps) {
    const { primary } = useThemeColor();
    const viewShotRef = useRef<ViewShot>(null);
    const [sharing, setSharing] = useState(false);
    const [cardLayout, setCardLayout] = useState<{ width: number; height: number } | null>(null);
    const [imagesLoaded, setImagesLoaded] = useState(false);
    const [arabicTextHeight, setArabicTextHeight] = useState(160);

    // Preload images for sharing - ensure they're cached before capture
    React.useEffect(() => {
        const preloadImages = async () => {
            try {
                await Promise.all([
                    Image.prefetch(Image.resolveAssetSource(require('@/assets/images/icon.png')).uri),
                    Image.prefetch(Image.resolveAssetSource(require('@/assets/images/appstore.png')).uri),
                    Image.prefetch(Image.resolveAssetSource(require('@/assets/images/playstore.png')).uri),
                ]);
                setImagesLoaded(true);
            } catch (error) {
                console.warn('[DetailedDuaCard] Image preload failed:', error);
                setImagesLoaded(true); // Continue anyway
            }
        };
        preloadImages();
    }, []);

    // Status Badge Logic
    const getStatusBadge = () => {
        switch (status) {
            case 'perfect':
                return (
                    <View style={[styles.statusBadge, { borderColor: '#FFD700', backgroundColor: 'rgba(255, 215, 0, 0.1)' }]}>
                        <Star size={14} color="#FFD700" fill="#FFD700" />
                    </View>
                );
            case 'memorized':
                return (
                    <View style={[styles.statusBadge, { borderColor: '#F9E79F', backgroundColor: 'rgba(212, 175, 55, 0.15)' }]}>
                        <Star size={14} color="#F9E79F" fill="#F9E79F" />
                    </View>
                );
            case 'revised':
                return (
                    <View style={[styles.statusBadge, { borderColor: '#2196F3', backgroundColor: 'rgba(33, 150, 243, 0.1)' }]}>
                        <RefreshCw size={14} color="#2196F3" />
                    </View>
                );
            default:
                return (
                    <View style={[styles.statusBadge, { borderColor: '#94A3B8', backgroundColor: 'rgba(148, 163, 184, 0.1)' }]}>
                        <Clock size={14} color="#94A3B8" />
                    </View>
                );
        }
    };

    const handleShare = async () => {
        if (!viewShotRef.current || sharing || !imagesLoaded) return;
        setSharing(true);
        try {
            // Wait for layout and font rendering
            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        setTimeout(() => resolve(), 300); // 300ms for heavy Arabic ligatures
                    });
                });
            });

            // Capture with device pixel ratio
            const uri = await viewShotRef.current.capture?.();
            if (!uri) throw new Error('Capture failed');

            const storeUrl = Platform.OS === 'ios'
                ? 'https://apps.apple.com/sg/app/ihafidh/id6752505055'
                : 'https://play.google.com/store/apps/details?id=com.ihafidh';

            await Share.open({
                url: uri.startsWith('file://') ? uri : `file://${uri}`,
                title: 'Share Dua',
                message: `${dua.theme}\n\nSurah ${dua.surahNumber}:${dua.verseNumber}\n\nDownload iHafidh: ${storeUrl}`,
                subject: 'Quranic Dua from iHafidh',
            });

            logAnalyticsEvent('social_share', {
                content_type: 'detailed_dua',
                surah_id: dua.surahNumber,
                verse_number: dua.verseNumber,
            });
            logAnalyticsEvent('share_triggered', {
                content_type: 'detailed_dua',
                surah_id: dua.surahNumber,
                verse_number: dua.verseNumber,
            });
        } catch (error: any) {
            const msg = error?.message || '';
            if (!msg.includes('User did not share') && !msg.includes('User cancelled')) {
                console.error('Share error:', error);
            }
        } finally {
            setSharing(false);
        }
    };

    const arabicContent = verseData?.ayah || dua.arabicSnippet || '';

    return (
        <View style={{ position: 'relative' }}>
            {/* Hidden images to preload/cache them for share capture */}
            <View style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}>
                <Image source={require('@/assets/images/icon.png')} style={{ width: 1, height: 1 }} />
                <Image source={require('@/assets/images/appstore.png')} style={{ width: 1, height: 1 }} />
                <Image source={require('@/assets/images/playstore.png')} style={{ width: 1, height: 1 }} />
            </View>

            {/* ViewShot wrapper for capturing */}
            <ViewShot
                ref={viewShotRef}
                options={{
                    format: 'png',
                    quality: 1.0,
                    result: 'tmpfile',
                    // Capture high-res: Target 1080p width, dynamic height (min 1920p for stories)
                    width: sharing ? 1080 : Math.round((cardLayout?.width || 1080) * (PixelRatio.get() || 1)),
                    height: sharing ? Math.max(1920, Math.round((cardLayout?.height || 0) * (PixelRatio.get() || 1))) : Math.round((cardLayout?.height || 1080) * (PixelRatio.get() || 1)),
                }}
            >
                <LinearGradient
                    colors={['#D4AF37', '#F9E79F', '#B8860B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.metallicBorder, sharing && { marginHorizontal: 0, marginBottom: 0, padding: 0, borderRadius: 0, borderWidth: 0 }]}
                >
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={onPress}
                        style={styles.cardContainer}
                        onLayout={(e) => setCardLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
                    >
                        <LinearGradient
                            colors={sharing ? ['#05080F', '#111827', '#05080F'] as const : ['#05080F', '#111827'] as const}
                            style={[
                                styles.cardGradient,
                                status === 'memorized' && styles.memorizedCardInner,
                                sharing && styles.sharingCard
                            ]}
                        >
                            {/* Islamic Pattern Overlay */}
                            <IslamicPatternOverlay />

                            {/* Content Wrapper for Sharing (Pushes Footer down) */}
                            <View style={sharing ? { flex: 1 } : undefined}>

                                {/* Header: Category & Status */}
                                <View style={styles.cardHeader}>
                                    <View style={styles.badgeRow}>
                                        <View style={styles.categoryBadge}>
                                            <Text style={styles.categoryText}>
                                                {dua.category.toUpperCase()}
                                                {dua.subcategory ? ` • ${dua.subcategory.toUpperCase()}` : ''}
                                            </Text>
                                        </View>
                                        {getStatusBadge()}
                                    </View>
                                </View>

                                {/* Title & Reference */}
                                <View style={styles.metaSection}>
                                    <Text style={styles.themeTitle}>{dua.theme}</Text>
                                    <View style={styles.referenceRow}>
                                        <Text style={styles.referenceText}>
                                            Surah {dua.surahNumber}:{dua.verseNumber}{dua.verseNumberEnd ? `-${dua.verseNumberEnd}` : ''}
                                        </Text>
                                        <View style={styles.juzBadge}>
                                            <Text style={styles.juzText}>Juz {dua.juz}</Text>
                                        </View>
                                        {dua.prophet && (
                                            <View style={[styles.juzBadge, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
                                                <Text style={[styles.juzText, { color: '#D4AF37' }]}>{dua.prophet}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>

                                {/* Arabic Text Area with Glint Effect - FIXED: Dynamic height */}
                                <View style={styles.arabicContainer}>
                                    <RadialTextGlow />
                                    {/* Decorative Corner Ornaments */}
                                    <Text style={[styles.cornerOrnament, { top: 10, left: 10 }]}>✦</Text>
                                    <Text style={[styles.cornerOrnament, { top: 10, right: 10 }]}>✦</Text>
                                    <Text style={[styles.cornerOrnament, { bottom: 10, left: 10 }]}>✦</Text>
                                    <Text style={[styles.cornerOrnament, { bottom: 10, right: 10 }]}>✦</Text>

                                    <MaskedView
                                        style={{ width: '100%', height: arabicTextHeight }} // FIXED: Applied explicit height
                                        maskElement={
                                            <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}>
                                                <Text
                                                    style={styles.arabicText}
                                                    allowFontScaling={false}
                                                    onLayout={(e) => {
                                                        // Track actual rendered height
                                                        const measuredHeight = e.nativeEvent.layout.height;
                                                        if (measuredHeight > 0) {
                                                            setArabicTextHeight(measuredHeight + 10); // Added small buffer for diacritics
                                                        }
                                                    }}
                                                >
                                                    {arabicContent}
                                                </Text>
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
                                </View>

                                {/* Translation & Context */}
                                <View style={styles.translationContainer}>
                                    <Text style={styles.translation}>
                                        "{verseData?.translation || "Translation loading..."}"
                                    </Text>

                                    {dua.context && (
                                        <View style={styles.contextContainer}>
                                            <Text style={styles.contextText}>{dua.context}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {sharing && <BrandedFooter />}


                            {/* Action Buttons */}
                            <View style={styles.actionRow}>
                                {onPlayAudio && (
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={onPlayAudio}
                                    >
                                        <Play size={14} color="#D4AF37" fill="#D4AF37" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </LinearGradient>
            </ViewShot>

            {/* Share Button - Outside ViewShot */}
            <Pressable
                style={styles.shareButton}
                onPress={handleShare}
                disabled={sharing}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                {sharing ? (
                    <ActivityIndicator size="small" color="#D4AF37" />
                ) : (
                    <Share2 size={16} color="#D4AF37" />
                )}
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    cardContainer: {
        borderRadius: 15,
        overflow: 'hidden',
        backgroundColor: '#05080F',
    },
    metallicBorder: {
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 1,
        borderRadius: 16,
        backgroundColor: '#05080F',
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 5,
    },
    cardGradient: {
        padding: 20,
        borderRadius: 16,
        position: 'relative',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    categoryBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    categoryText: {
        color: '#D4AF37',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    metaSection: {
        marginBottom: 24,
    },
    themeTitle: {
        fontSize: 20,
        color: '#F9E79F',
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        marginBottom: 8,
        fontWeight: '700',
        letterSpacing: 1,
        textShadowColor: 'rgba(212, 175, 55, 0.4)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    referenceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    referenceText: {
        color: '#94A3B8',
        fontSize: 14,
    },
    juzBadge: {
        backgroundColor: '#1E293B',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    juzText: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '600',
    },
    // FIXED: arabicContainer - removed minHeight, let content dictate size
    arabicContainer: {
        backgroundColor: 'rgba(5, 8, 15, 0.8)',
        paddingHorizontal: 20,
        paddingVertical: 20, // Consistent padding
        borderRadius: 12,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        // No minHeight - flexbox will size to content
    },
    cornerOrnament: {
        position: 'absolute',
        color: '#D4AF37',
        opacity: 0.5,
        fontSize: 10,
        zIndex: 5,
    },
    // FIXED: arabicText - reduced lineHeight from 69 to 50 (1.67x font size)
    arabicText: {
        fontSize: 30,
        lineHeight: Platform.select({
            ios: 52, // iOS handles Arabic better
            android: 50, // Android needs tighter spacing
        }),
        color: '#F9E79F',
        textAlign: 'center',
        fontFamily: 'KFGQPC-Uthman-Taha',
        writingDirection: 'rtl',
        backgroundColor: 'transparent',
        paddingVertical: 8, // Reduced from 10
    },
    translationContainer: {
        marginTop: 10,
        paddingLeft: 16,
        borderLeftWidth: 3,
        borderLeftColor: 'rgba(212, 175, 55, 0.6)',
        opacity: 0.9,
    },
    translation: {
        fontSize: 16,
        color: '#f4e4b7',
        lineHeight: 26,
        fontFamily: Platform.OS === 'ios' ? 'EB Garamond' : 'serif',
        fontStyle: 'italic',
    },
    contextContainer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(148, 163, 184, 0.1)',
    },
    contextText: {
        fontSize: 13,
        color: '#94A3B8',
        lineHeight: 18,
        fontStyle: 'normal',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    },
    memorizedCardInner: {
        borderWidth: 1,
        borderColor: '#F9E79F',
        borderRadius: 15,
    },
    memorizedCard: {
        ...Platform.select({
            ios: {
                shadowColor: '#D4AF37',
                shadowOpacity: 0.5,
                shadowRadius: 15,
                shadowOffset: { width: 0, height: 0 },
            },
            android: {
                elevation: 10,
            }
        })
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        marginLeft: 4,
        letterSpacing: 0.5,
    },
    sharingCard: {
        width: 1080 / PixelRatio.get(),
        minHeight: 1920 / PixelRatio.get(),
        paddingTop: 80,
        paddingBottom: 40,
        justifyContent: 'space-between',
        borderRadius: 0,
    },
    actionRow: {
        position: 'absolute',
        bottom: 20,
        right: 20,
    },
    actionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    shareButton: {
        position: 'absolute',
        top: 20,
        right: 32,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.4)',
        zIndex: 10,
    },
    // Branded Footer Styles
    brandedFooter: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
        position: 'relative',
        backgroundColor: '#05080FF5',
    },
    footerTopAccent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 1,
    },
    footerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    appIconWrapper: {
        position: 'relative',
    },
    appIconGlow: {
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        borderRadius: 18,
        backgroundColor: '#D4AF37',
        opacity: 0.15,
    },
    appIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1.5,
        borderColor: '#D4AF3730',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    appIcon: {
        width: '100%',
        height: '100%',
    },
    brandInfoContainer: {
        flex: 1,
        gap: 6,
    },
    brandTextContainer: {
        gap: 1,
    },
    appName: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
        color: '#F8FAFC',
    },
    appTagline: {
        fontSize: 10,
        fontWeight: '500',
        opacity: 0.8,
        color: '#94A3B8',
    },
    compactBadgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    downloadText: {
        fontSize: 9,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        opacity: 0.7,
        color: '#94A3B8',
    },
    compactStoreBadge: {
        height: 18,
        width: 54,
        justifyContent: 'center',
        alignItems: 'center',
    },
    compactBadgeImage: {
        height: 18,
        width: 54,
        opacity: 0.85,
    },
});