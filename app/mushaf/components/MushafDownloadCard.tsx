import { useMushafDownload } from '@/app/mushaf/hooks/useMushafDownload';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Download } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';


// GOLDEN-BROWN THEME (matching your Quick Actions)
const ICON_GRADIENT: [string, string, string] = ['#FCD34D', '#FBBF24', '#D97706'];
const BORDER_COLOR = 'rgba(217, 119, 6, 0.6)';
const BORDER_COLOR_HOVER = 'rgba(217, 119, 6, 0.8)';
// const BG_COLOR = 'rgba(31, 41, 55, 0.8)'; // reserved if needed later
const BADGE_BG_AMBER = 'rgba(252, 211, 77, 0.15)';
const BADGE_TEXT_AMBER = '#FBBF24';

const PAGES = 610;
const SIZE_MB = 60; // Changed from 3.5GB to 60MB

export const MushafDownloadCard: React.FC = () => {
  const { status, progress, startDownload } = useMushafDownload();
  const router = useRouter();

  // Displayed (heuristic) percent shown to the user. We cap at 95% so it
  // never shows 100% before the component actually transitions to ready.
  const [displayPercent, setDisplayPercent] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animations
  const iconBounce = useRef(new Animated.Value(0)).current;
  const [isPressed, setPressed] = React.useState(false);

  useEffect(() => {
    if (status === 'downloading') {
      // Bounce animation while downloading
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconBounce, { toValue: -6, duration: 150, useNativeDriver: true }),
          Animated.timing(iconBounce, { toValue: 0, duration: 150, useNativeDriver: true }),
        ])
      ).start();
    } else {
      iconBounce.setValue(0);
    }
    // Auto-open on ready was intentionally disabled to avoid unexpected navigation.
  }, [status, iconBounce]);

  // Heuristic progress updater: uses real progress when available but caps at
  // 95%. If the real progress lags, the displayed value will creep slowly
  // upward to give the user a feeling of motion.
  useEffect(() => {
    // Clear any previous interval when status changes
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (status === 'downloading') {
      // Initialize from real progress (capped)
      const initial = Math.min(Math.round(progress?.percentage ?? 0), 95);
      setDisplayPercent((p) => Math.max(p, initial));

      intervalRef.current = setInterval(() => {
        setDisplayPercent((prev) => {
          const real = Math.min(Math.round(progress?.percentage ?? 0), 95);

          if (prev < real) {
            // Move a chunk towards the real value when it advances
            const diff = real - prev;
            const step = Math.max(1, Math.ceil(diff * 0.35));
            return Math.min(real, prev + step);
          }

          if (prev < 95) {
            // Slow creep while stuck (1% every tick)
            return Math.min(95, prev + 1);
          }

          return prev;
        });
      }, 700);
    } else {
      // Not downloading: stop any interval and reset or preserve percent
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (status === 'not-installed') setDisplayPercent(0);
      else if (status === 'ready') setDisplayPercent(95);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status, progress?.percentage]);

  // Animated width for progress fill (0-100)
  const animatedWidth = useRef(new Animated.Value(displayPercent)).current;
  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: displayPercent,
      duration: 420,
      useNativeDriver: false,
    }).start();
  }, [displayPercent, animatedWidth]);

  const handlePress = () => {
    if (status === 'not-installed') {
      startDownload();
    } else if (status === 'ready') {
      router.push('/mushaf/viewer');
    }
  };

  // Icon - Always book emoji, properly sized
  const icon = <Text style={styles.iconEmoji}>📖</Text>;

  // Title and badge based on state - NO SUBTITLE
  const title = 'Mushaf (15 lines)';
  let badge: React.ReactNode = null;

  if (status === 'not-installed') {
    badge = (
      <TouchableOpacity style={styles.iconButton} onPress={() => startDownload()} accessibilityLabel="Download Mushaf" accessibilityRole="button">
        {/* Download icon */}
        <Download size={20} color={BADGE_TEXT_AMBER} />
      </TouchableOpacity>
    );
  } else if (status === 'downloading') {
    badge = (
      <View style={styles.badge}>
        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressFill, { width: animatedWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
        </View>
        <Text style={styles.badgeText}>{displayPercent}%</Text>
      </View>
    );
  } else if (status === 'ready') {
    // No separate post-download icon — status will include the checkmark inline.
    badge = null;
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { borderColor: pressed ? BORDER_COLOR_HOVER : BORDER_COLOR },
      ]}
      onPress={handlePress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel="Mushaf Download Card"
    >
      {/* Icon Container */}
      <Animated.View
        style={[
          styles.iconContainer,
          {
            transform: [
              { scale: isPressed ? 1.05 : 1 },
              { translateY: iconBounce },
            ],
          },
        ]}
      >
        <LinearGradient colors={ICON_GRADIENT} style={styles.iconGradient as any}>
          {icon}
        </LinearGradient>
      </Animated.View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">{title}</Text>
        <Text style={styles.stats}>
          {PAGES} pages • {SIZE_MB}MB • {status === 'ready' ? 'Downloaded ✓' : status === 'downloading' ? 'Downloading' : 'Not downloaded'}
        </Text>
      </View>

      {/* Badge container - absolutely positioned bottom-right so title can use full width */}
      <View style={styles.badgeWrap} pointerEvents="box-none">
        {badge}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#333',
    gap: 12,
    marginHorizontal: 0,
    alignSelf: 'stretch',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    flexShrink: 0,
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconEmoji: {
    fontSize: 22,
    lineHeight: 22,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0,
    paddingRight: 56, // reserved room for badge - increased for Android
    justifyContent: 'center',
  },
  title: {
    fontSize: 15, // Reduced slightly for better fit
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
    lineHeight: 18,
  },
  stats: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  // GOLDEN-BROWN BADGE (Download / Percentage)
  badge: {
    backgroundColor: BADGE_BG_AMBER,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: BADGE_TEXT_AMBER,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    flexShrink: 0,
  },
  badgeText: {
    color: BADGE_TEXT_AMBER,
    fontWeight: '700',
    fontSize: 13,
  },
  // GOLDEN-BROWN READY BADGE (with pulsing dot)
  badgeReady: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BADGE_BG_AMBER,
    borderRadius: 12,
  paddingHorizontal: 10,
  paddingVertical: 6,
    borderWidth: 1,
    borderColor: BADGE_TEXT_AMBER,
    justifyContent: 'center',
    minWidth: 64,
    flexShrink: 0,
  },
  badgeReadyText: {
    color: BADGE_TEXT_AMBER,
    fontWeight: '700',
    fontSize: 13,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BADGE_TEXT_AMBER,
    marginRight: 6,
  },
  badgeWrap: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 64,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  // Icon-style button for download/open
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: BADGE_BG_AMBER,
    borderWidth: 1,
    borderColor: BADGE_TEXT_AMBER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonReady: {
    backgroundColor: 'rgba(45, 212, 191, 0.08)',
    borderColor: '#2dd4bf',
  },
  iconBtnText: { fontSize: 18 },
  progressBar: {
    width: 88,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: BADGE_TEXT_AMBER,
  },
});

export default MushafDownloadCard;