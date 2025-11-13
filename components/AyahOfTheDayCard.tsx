import { surahsData } from '@/data/surahs';
import { fetchSingleVerse } from '@/services/quranApi';
import { useBookmarkStore } from '@/store/bookmarkStore';
import { useSettingsStore } from '@/store/settingsStore';
import { getTodayCardVerse } from '@/utils/ayahOfTheDay';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Share2, Sparkles } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, AppStateStatus, Image, Linking, PixelRatio, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Share from 'react-native-share';
import Svg, { Circle, Defs, Stop, RadialGradient as SvgRadialGradient } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';


// Dynamic background patterns based on day - inspired by the web version
function getBackgroundPattern(dayIndex: number) {
  const patterns = [
    { type: 'dots', opacity: 0.03 },
    { type: 'sparkles', opacity: 0.04 },
    { type: 'waves', opacity: 0.02 },
    { type: 'gradients', opacity: 0.04 },
    { type: 'grid', opacity: 0.02 },
    { type: 'diagonal', opacity: 0.02 },
    { type: 'squares', opacity: 0.015 },
  ];

  const patternIndex = dayIndex % patterns.length;
  return patterns[patternIndex];
}

// Color palette helper
function getColorPalette(dayIndex: number) {
  const palettes = [
    {
      primary: '#1e1e1e', // darker grey 
      secondary: '#2a2a2a', // slightly lighter grey
      accent: '#fbbf24', // yellow-400
      text: '#f9fafb', // gray-50
      subtext: '#d1d5db', // gray-300
    },
    {
      primary: '#1e1e1e', // darker grey 
      secondary: '#2a2a2a', // slightly lighter grey
      accent: '#f59e0b', // amber-500
      text: '#f1f5f9', // slate-100
      subtext: '#cbd5e1', // slate-300
    },
    {
      primary: '#1e1e1e', // darker grey 
      secondary: '#2a2a2a', // slightly lighter grey
      accent: '#eab308', // yellow-500
      text: '#fafafa', // zinc-50
      subtext: '#d4d4d8', // zinc-300
    },
    {
      primary: '#1e1e1e', // darker grey 
      secondary: '#2a2a2a', // slightly lighter grey
      accent: '#f97316', // orange-500
      text: '#fafaf9', // stone-50
      subtext: '#d6d3d1', // stone-300
    },
    {
      primary: '#1e1e1e', // darker grey 
      secondary: '#2a2a2a', // slightly lighter grey
      accent: '#84cc16', // lime-500
      text: '#f0fdf4', // green-50
      subtext: '#bbf7d0', // green-200
    },
    {
      primary: '#1e1e1e', // darker grey 
      secondary: '#2a2a2a', // slightly lighter grey
      accent: '#3b82f6', // blue-500
      text: '#eff6ff', // blue-50
      subtext: '#bfdbfe', // blue-200
    },
    {
      primary: '#1e1e1e', // darker grey 
      secondary: '#2a2a2a', // slightly lighter grey
      accent: '#a855f7', // purple-500
      text: '#faf5ff', // purple-50
      subtext: '#d8b4fe', // purple-300
    },
  ];

  const paletteIndex = dayIndex % palettes.length;
  return palettes[paletteIndex];
}

// Dynamic Pattern Component
const DynamicPatternOverlay = ({ pattern, colors }: { pattern: any; colors: any }) => {
  const renderPattern = () => {
    switch (pattern.type) {
      case 'dots':
        return (
          <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
            <Defs>
              <SvgRadialGradient id="dotGradient" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={colors.accent} stopOpacity={pattern.opacity} />
                <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
              </SvgRadialGradient>
            </Defs>
            <Circle cx="20%" cy="30%" r="40" fill="url(#dotGradient)" />
            <Circle cx="80%" cy="70%" r="60" fill="url(#dotGradient)" />
            <Circle cx="60%" cy="20%" r="30" fill="url(#dotGradient)" />
          </Svg>
        );
      case 'sparkles':
        return (
          <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
            <Defs>
              <SvgRadialGradient id="sparkleGradient" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={colors.accent} stopOpacity={pattern.opacity} />
                <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
              </SvgRadialGradient>
            </Defs>
            <Circle cx="15%" cy="20%" r="25" fill="url(#sparkleGradient)" />
            <Circle cx="85%" cy="70%" r="35" fill="url(#sparkleGradient)" />
            <Circle cx="50%" cy="50%" r="20" fill="url(#sparkleGradient)" />
            <Circle cx="70%" cy="25%" r="15" fill="url(#sparkleGradient)" />
          </Svg>
        );
      default:
        return null;
    }
  };

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {renderPattern()}
    </View>
  );
};

interface AyahOfTheDayCardProps { 
  style?: any; 
}

// Branded Footer Component for Share Image - Modern & Compact Design
const BrandedFooter = ({ colors }: { colors: any }) => {
  const openPlayStore = async () => {
    const intent = 'market://details?id=com.ihafidh';
    const web = 'https://play.google.com/store/apps/details?id=com.ihafidh';
    try { await Linking.openURL(intent); } catch { await Linking.openURL(web); }
  };
  const openAppStore = async () => {
    const url = 'https://apps.apple.com/sg/app/ihafidh/id6752505055';
    try { await Linking.openURL(url); } catch {}
  };
  return (
    <View style={[styles.brandedFooter, { backgroundColor: colors.primary + 'f5' }]}>
      {/* Subtle top border accent */}
      <LinearGradient
        colors={[colors.accent + '40', 'transparent', colors.accent + '40']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.footerTopAccent}
      />
      
      <View style={styles.footerContent}>
        {/* Prominent App Icon with glow effect */}
        <View style={styles.appIconWrapper}>
          <View style={[styles.appIconGlow, { backgroundColor: colors.accent }]} />
          <View style={[styles.appIconContainer, { borderColor: colors.accent + '30' }]}>
            <Image 
              source={require('@/assets/images/icon.png')} 
              style={styles.appIcon}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Brand Info & Badges */}
        <View style={styles.brandInfoContainer}>
          {/* App Name & Tagline */}
          <View style={styles.brandTextContainer}>
            <Text style={[styles.appName, { color: colors.text }]}>iHafidh</Text>
            <Text style={[styles.appTagline, { color: colors.subtext }]}>
              Your Quran Companion
            </Text>
          </View>

          {/* Compact Store Badges */}
          <View style={styles.compactBadgesRow}>
            <Text style={[styles.downloadText, { color: colors.subtext }]}>Download:</Text>
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

export const AyahOfTheDayCard: React.FC<AyahOfTheDayCardProps> = ({ style }) => {
  const translationLang = useSettingsStore(state => state.translationLanguage) || 'en.asad';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [ayah, setAyah] = useState<{ 
    verseId: number;
    surahId: number; 
    verseNumber: number; 
    surahName: string; 
    arabicName: string; 
    arabicText: string;
    translation: string 
  } | null>(null);
  const dayKeyRef = useRef<string>('');
  const mountedRef = useRef(true);
  const { addBookmark } = useBookmarkStore();
  const viewShotRef = useRef<ViewShot>(null);
  const [cardLayout, setCardLayout] = useState<{ width: number; height: number } | null>(null);

  const computeKey = (d = new Date()) => d.toISOString().split('T')[0];

  const loadAyah = useCallback(async () => {
    setLoading(true); 
    setError(null);
    try {
      const today = new Date();
      const key = computeKey(today);
      dayKeyRef.current = key;
      
      // Get today's curated verse
      const cardVerse = getTodayCardVerse(today);
      const surah = surahsData.find(s => s.id === cardVerse.surahId);
      
      if (!surah) throw new Error('Surah not found');
      
      const verse = await fetchSingleVerse(cardVerse.surahId, cardVerse.verseNumber, translationLang);
      if (!verse) throw new Error('Fetch failed');
      if (!mountedRef.current) return;
      
      setAyah({
        verseId: verse.id,
        surahId: cardVerse.surahId,
        verseNumber: cardVerse.verseNumber,
        surahName: surah.name || `Surah ${cardVerse.surahId}`,
        arabicName: surah.arabicName || '',
        arabicText: verse.arabicText || '',
        translation: verse.translation || 'No translation available',
      });
      console.log('[AyahOfTheDay] Loaded verse:', {
        verseId: verse.id,
        surahId: cardVerse.surahId,
        surahName: surah.name,
        verseNumber: cardVerse.verseNumber,
        arabicPreview: verse.arabicText?.substring(0, 50)
      });
    } catch (e: any) {
      setError(e?.message || 'Unable to load today\'s ayah');
      setAyah(null);
    } finally {
      setLoading(false);
    }
  }, [translationLang]);

  // Initial load
  useEffect(() => { 
    loadAyah(); 
  }, [loadAyah]);

  useEffect(() => { 
    return () => { 
      mountedRef.current = false; 
    }; 
  }, []);

  // Refresh if app returns to foreground on a new day
  useEffect(() => {
    const listener = (s: AppStateStatus) => {
      if (s === 'active') {
        const keyNow = computeKey();
        if (dayKeyRef.current && keyNow !== dayKeyRef.current) {
          loadAyah();
        }
      }
    };
    const sub = AppState.addEventListener('change', listener);
    return () => { 
      try { 
        sub.remove(); 
      } catch {} 
    };
  }, [loadAyah]);

  // Get today's pattern and colors
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const diff = (today.getTime() - startOfYear.getTime()) + ((startOfYear.getTimezoneOffset() - today.getTimezoneOffset()) * 60000);
  const dayOfYear = Math.floor(diff / 86400000);
  
  const pattern = useMemo(() => getBackgroundPattern(dayOfYear), [dayOfYear]);
  const colors = useMemo(() => getColorPalette(dayOfYear), [dayOfYear]);

  const handlePress = async () => {
    if (!ayah) return;
    // Mirror bookmark flow: haptic feedback, add bookmark, then navigate
    Haptics.selectionAsync().catch(() => {});
    try {
      await addBookmark(
        ayah.verseId,
        ayah.surahId,
        ayah.surahName,
        ayah.verseNumber,
        ayah.arabicText,
        ayah.translation
      );
    } catch {}
    // Replace navigation when opening a specific verse to avoid duplicate Read entries
    // After fixing FlashList keys and recycling issues, scroll to specific verse should work reliably
    try { router.replace(`/(tabs)/read?surahId=${ayah.surahId}&verseId=${ayah.verseId}`); } catch { router.push(`/(tabs)/read?surahId=${ayah.surahId}&verseId=${ayah.verseId}`); }
  };

  const handleShare = async () => {
    if (!ayah || !viewShotRef.current || sharing) return;
    setSharing(true);
    try {
      // Wait a few frames so conditional branding becomes visible before capture
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      // If we don't have a measured layout yet, wait briefly for onLayout to run
      const maxWait = 500; // ms
      const pollInterval = 30;
      let waited = 0;
      while (!cardLayout && waited < maxWait) {
        // small delay to allow layout pass
         
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        waited += pollInterval;
      }

      // Determine capture size using device pixel ratio so the image matches native resolution
      const dpr = PixelRatio.get() || 1;
      const captureWidth = Math.round((cardLayout?.width || 1080) * dpr);
      const captureHeight = Math.round((cardLayout?.height || 1080) * dpr);

      // If the ViewShot component supports dynamic options via props, we set them via the ref by updating a local prop.
      // But capture() in our typings doesn't accept args, so call capture() with no args and ensure ViewShot has been given
      // an appropriate width/height via its props (below). We'll fall back to the returned uri.
      const uri = await viewShotRef.current.capture?.();
      if (!uri) throw new Error('Capture failed');
      
      // Platform-specific store URLs
      const storeUrl = Platform.OS === 'ios' 
        ? 'https://apps.apple.com/sg/app/ihafidh/id6752505055'
        : 'https://play.google.com/store/apps/details?id=com.ihafidh';
      
      await Share.open({
        url: uri.startsWith('file://') ? uri : `file://${uri}`,
        title: 'Share Ayah of the Day',
        message: `${ayah.surahName} • Ayah ${ayah.verseNumber}\n\nDownload iHafidh: ${storeUrl}`,
        subject: 'Ayah of the Day from iHafidh',
      });
    } catch (error: any) {
      const msg = error?.message || '';
      if (!msg.includes('User did not share') && !msg.includes('User cancelled')) {
        try { Alert.alert('Share Failed', 'Unable to share the ayah. Please try again.'); } catch {}
        console.error('Share error:', error);
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={[styles.containerWrapper, style]}>
      {/* ViewShot wrapper for capturing as image */}
      <ViewShot
        ref={viewShotRef}
        options={{
          format: 'png',
          quality: 1.0,
          result: 'tmpfile',
          width: Math.round((cardLayout?.width || 1080) * (PixelRatio.get() || 1)),
          height: Math.round((cardLayout?.height || 1080) * (PixelRatio.get() || 1)),
        }}
        style={[styles.viewShotContainer, { backgroundColor: colors.primary }]}
      >
        {/* Subtle Glow Effect */}
        <View style={[styles.glowEffect, { backgroundColor: colors.accent }]} />

        {/* Main Card */}
        <Pressable
          style={styles.cardContainer}
          onPress={handlePress}
          onLayout={(e) => setCardLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        >
          <View style={styles.gradient}>
            {/* Dynamic Background Pattern */}
            <DynamicPatternOverlay pattern={pattern} colors={colors} />

            {/* Top Border Accent */}
            <LinearGradient
              colors={['transparent', colors.accent, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topBorder}
            />

            {/* Content Container */}
            <View style={styles.contentContainer}>
              {/* Header */}
              <View style={styles.header}>
                <View style={[styles.iconContainer, { backgroundColor: colors.accent }]}> 
                  <Sparkles size={14} color={colors.secondary} />
                </View>
                <Text style={[styles.headerText, { color: colors.accent }]}>Ayah of the Day</Text>
              </View>

              {/* Loading State */}
              {loading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={colors.accent} size="small" />
                  <Text style={[styles.loadingText, { color: colors.subtext }]}>Loading today's ayah...</Text>
                </View>
              )}

              {/* Error State */}
              {!loading && error && (
                <View style={styles.errorContainer}>
                  <Text style={[styles.errorText, { color: '#fca5a5' }]} numberOfLines={3}>
                    {error}
                  </Text>
                </View>
              )}

              {/* Content */}
              {!loading && ayah && (
                <>
                  {/* Translation Text */}
                  <View style={styles.translationContainer}>
                    <Text style={[styles.translationText, { color: colors.text }]}>
                      {ayah.translation.replace(/<[^>]+>/g, '')}
                    </Text>
                  </View>

                  {/* Reference */}
                  <View style={styles.referenceContainer}>
                    <Text style={[styles.referenceText, { color: colors.accent }]}> 
                      {ayah.surahName}
                    </Text>
                    <Text style={[styles.referenceSeparator, { color: colors.subtext }]}>•</Text>
                    <Text style={[styles.referenceNumber, { color: colors.subtext }]}> 
                      {ayah.verseNumber}
                    </Text>
                  </View>

                </>
              )}
            </View>

            {/* Branded Footer - only visible in shared image */}
            {sharing && <BrandedFooter colors={colors} />}

            {/* Decorative Overlay */}
            <View style={[styles.decorativeOverlay, { backgroundColor: colors.accent }]} />
          </View>
        </Pressable>
      </ViewShot>

      {/* Share Button - Outside ViewShot */}
      {!loading && ayah && (
        <Pressable
          style={[styles.shareButtonExternal, { backgroundColor: colors.accent + '20' }]}
          onPress={handleShare}
          disabled={sharing}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {sharing ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Share2 size={16} color={colors.accent} />
          )}
        </Pressable>
      )}

      {/* Helper text */}
      <View style={styles.helperTextContainer}>
        <Text style={[styles.helperText, { color: colors.subtext }]}>Tap to read</Text>
      </View>
    </View>
  );

};

const styles = StyleSheet.create({
  containerWrapper: {
    marginVertical: 8,
    position: 'relative',
  },
  viewShotContainer: {
    backgroundColor: 'transparent',
  },
  glowEffect: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 24,
    opacity: 0.1,
    transform: [{ scale: 1.02 }],
  },
  cardContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  gradient: {
    padding: 0,
    minHeight: 200,
    position: 'relative',
  },
  topBorder: {
    height: 2,
    width: '100%',
  },
  contentContainer: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  translationContainer: {
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  translationText: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  referenceContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
    gap: 6,
  },
  referenceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  referenceSeparator: {
    fontSize: 12,
  },
  referenceNumber: {
    fontSize: 12,
    fontWeight: '400',
  },
  // Branded Footer Styles - Modern & Compact Design
  brandedFooter: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
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
    opacity: 0.15,
  },
  appIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
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
  },
  appTagline: {
    fontSize: 10,
    fontWeight: '500',
    opacity: 0.8,
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
  storeBadgeImageWrap: {
    height: 36,
    width: 126,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeBadgeImage: {
    height: 36,
    width: 126,
  },
  decorativeOverlay: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.05,
  },
  helperTextContainer: {
    marginTop: 8,
    paddingHorizontal: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  helperText: {
    textAlign: 'center',
    fontSize: 11,
    opacity: 0.7,
  },
  shareButtonExternal: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  tapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    alignItems: 'center',
  },
});

export default AyahOfTheDayCard;