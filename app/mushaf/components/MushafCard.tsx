
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, Download } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMushafDownload } from '../hooks/useMushafDownload';

const PAGES = 610;
const SIZE_GB = 3.5;

export default function MushafCard() {
  const { status, progress, startDownload, cancel } = useMushafDownload();
  const router = useRouter();
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'downloading' && progress?.percentage != null) {
      Animated.timing(progressAnim, {
        toValue: progress.percentage,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else if (status !== 'downloading') {
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [status, progress?.percentage]);

  useEffect(() => {
    // NOTE: automatic navigation on 'ready' was removed. Navigation should
    // only occur via user interaction (pressing the card).
  }, [status, router]);

  useEffect(() => {
    console.log('[MushafCard] Status:', status);
    console.log('[MushafCard] Progress:', progress?.percentage);
    console.log('[MushafCard] Stage:', progress?.stage);
  }, [status, progress]);

  // State-specific rendering
  if (status === 'not-installed') {
    return (
      <Pressable style={[styles.card, styles.goldenBorder]} onPress={() => startDownload()}>
        <LinearGradient colors={["#FCD34D", "#FBBF24", "#D97706"]} style={styles.iconWrap}>
          <Text style={{fontSize:40, color:'#fff'}}>☿</Text>
        </LinearGradient>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Mushaf</Text>
          <Text style={styles.subtitle}>610-page offline Mushaf{"\n"}(downloadable)</Text>
        </View>
        <View style={styles.ctaWrap}>
          <Text style={styles.ctaText}>Tap to Download</Text>
          <ChevronRight color="#FCD34D" size={22} />
        </View>
      </Pressable>
    );
  }

  if (status === 'downloading') {
    const percent = progress?.percentage ?? 0;
    return (
      <View style={[styles.card, styles.goldenBorder]}>
        <LinearGradient colors={["#FCD34D", "#FBBF24", "#D97706"]} style={styles.iconWrap}>
          <Animated.View style={{ transform: [{ rotate: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0deg', '360deg'] }) }] }}>
            <Download color="#fff" size={40} />
          </Animated.View>
        </LinearGradient>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Mushaf</Text>
          <Text style={styles.subtitle}>610-page offline Mushaf</Text>
        </View>
        <View style={styles.progressBadge}>
          <Text style={styles.progressText}>{percent}%</Text>
        </View>
        <View style={styles.progressBarWrap}>
          <Animated.View style={[styles.progressBar, { width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
        </View>
        <Text style={styles.stageLabel}>{progress?.stage || 'Downloading...'}</Text>
        <Pressable style={styles.cancelBtn} onPress={cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'ready') {
    return (
      <Pressable style={[styles.card, styles.emeraldBorder]} onPress={() => router.push('/mushaf/viewer')}>
        <LinearGradient colors={["#34D399", "#10B981", "#059669"]} style={styles.iconWrap}>
          <Animated.View style={{ transform: [{ scale: progressAnim.interpolate({ inputRange: [0, 100], outputRange: [1, 1.15] }) }] }}>
            <Check color="#fff" size={40} />
          </Animated.View>
        </LinearGradient>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Mushaf</Text>
          <Text style={styles.readySubtitle}>Ready to explore 610 pages</Text>
        </View>
        <View style={styles.successBadgeWrap}>
          <Text style={styles.successBadgeText}>✓ Downloaded & Ready</Text>
        </View>
        <View style={styles.successLine} />
        <View style={styles.statsWrap}>
          <Text style={styles.statsText}>Pages: {PAGES}  |  Size: {SIZE_GB}GB  |  Status: ✓</Text>
        </View>
        <Text style={styles.ctaText}>Tap to Open →</Text>
      </Pressable>
    );
  }

  // Error fallback
  return (
    <View style={[styles.card, styles.errorBorder]}>
      <Text style={styles.errorText}>Error loading Mushaf. Please try again.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 18,
    margin: 10,
    backgroundColor: 'rgba(30, 30, 40, 0.95)',
    alignItems: 'center',
    shadowColor: '#B45309',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  goldenBorder: {
    borderWidth: 2,
    borderColor: 'rgba(217, 119, 6, 0.5)',
  },
  emeraldBorder: {
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.6)',
  },
  errorBorder: {
    borderWidth: 2,
    borderColor: '#DC2626',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#B45309',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  textWrap: {
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#FCD34D',
    opacity: 0.8,
    marginTop: 2,
    textAlign: 'center',
  },
  readySubtitle: {
    fontSize: 13,
    color: '#34D399',
    opacity: 0.8,
    marginTop: 2,
    textAlign: 'center',
  },
  ctaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  ctaText: {
    fontSize: 13,
    color: '#FCD34D',
    fontWeight: '600',
    marginRight: 4,
  },
  progressBadge: {
    position: 'absolute',
    right: 18,
    top: 18,
    backgroundColor: '#FCD34D',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    shadowColor: '#B45309',
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  progressText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#B45309',
    fontVariant: ['tabular-nums'],
  },
  progressBarWrap: {
    width: '100%',
    height: 7,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: 7,
    backgroundColor: '#FBBF24',
    borderRadius: 4,
    shadowColor: '#B45309',
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  stageLabel: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 6,
    fontWeight: '500',
    textAlign: 'center',
  },
  cancelBtn: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
  },
  cancelText: {
    color: '#B45309',
    fontWeight: '600',
    fontSize: 13,
  },
  successBadgeWrap: {
    marginTop: 8,
    marginBottom: 4,
    alignItems: 'center',
  },
  successBadgeText: {
    fontSize: 12,
    color: '#34D399',
    fontWeight: '600',
  },
  successLine: {
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(52, 211, 153, 0.6)',
    borderRadius: 2,
    marginVertical: 8,
  },
  statsWrap: {
    alignItems: 'center',
    marginBottom: 6,
  },
  statsText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '500',
    textAlign: 'center',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
    margin: 20,
  },
});
