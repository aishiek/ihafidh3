import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Defs, RadialGradient, Stop, Path, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface StreakShareCardProps {
  streakCount: number;
}

const FireStreakIcon = ({ size = 80 }) => (
  <View style={styles.flameShadow}>
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Defs>
        <SvgLinearGradient id="fireGradient" x1="0" y1="100" x2="0" y2="0" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#B03000" />
          <Stop offset="30%" stopColor="#FF4500" />
          <Stop offset="60%" stopColor="#FF8C00" />
          <Stop offset="100%" stopColor="#FFE066" />
        </SvgLinearGradient>
      </Defs>
      <Path
        d="M50 5C50 5 20 35 20 60C20 76.5685 33.4315 90 50 90C66.5685 90 80 76.5685 80 60C80 35 50 5 50 5Z"
        fill="url(#fireGradient)"
      />
      <Path
        d="M50 30C50 30 35 50 35 65C35 73.2843 41.7157 80 50 80C58.2843 80 65 73.2843 65 65C65 50 50 30 50 30Z"
        fill="#FFE066"
        opacity="0.8"
      />
    </Svg>
  </View>
);

const getMilestoneConfig = (streak: number) => {
  if (streak >= 365) return { emoji: '🕋', text: 'YEAR OF DEVOTION' };
  if (streak >= 180) return { emoji: '👑', text: 'HALF-YEAR HAFIDH' };
  if (streak >= 100) return { emoji: '🏆', text: 'CENTURY ACHIEVED' };
  if (streak >= 90) return { emoji: '🏆', text: '100 DAYS IMMINENT' };
  if (streak >= 60) return { emoji: '🥇', text: 'TWO MONTHS STRONG' };
  if (streak >= 50) return { emoji: '🥇', text: '50-DAY MILESTONE' };
  if (streak >= 40) return { emoji: '🏅', text: 'STRONG DEDICATION' };
  if (streak >= 30) return { emoji: '🏅', text: '30-DAY CHAMPION' };
  if (streak >= 21) return { emoji: '💎', text: 'ONE MONTH SOON' };
  if (streak >= 14) return { emoji: '🌟', text: 'CONSISTENT READER' };
  if (streak >= 10) return { emoji: '⭐', text: 'FIRST WEEK DONE' };
  if (streak >= 7) return { emoji: '🔥', text: 'ON FIRE!' };
  if (streak >= 4) return { emoji: '🔥', text: 'BUILDING THE HABIT' };
  if (streak >= 2) return { emoji: '✨', text: 'KEEP IT GOING' };
  return { emoji: '🌱', text: 'JOURNEY BEGINS' };
};

export const StreakShareCard: React.FC<StreakShareCardProps> = ({ streakCount }) => {
  const milestone = getMilestoneConfig(streakCount);
  const digitCount = streakCount.toString().length;
  const streakFontSize = digitCount > 3 ? 68 : digitCount > 2 ? 88 : 110;

  return (
    <View style={styles.cardContainer}>
      {/* 2. Top Accent Line */}
      <LinearGradient
        colors={['#FF8C00', '#FFE066']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topAccentLine}
      />

      <View style={styles.content}>
        {/* 3. Background Glow */}
        <View style={styles.glowFallback} />

        {/* 4. Flame Graphic */}
        <FireStreakIcon />

        {/* 5. Streak Number (Gradient Text) */}
        <MaskedView
          maskElement={
            <Text style={[styles.streakNumberMask, { fontSize: streakFontSize }]}>
              {streakCount}
            </Text>
          }
        >
          <LinearGradient
            colors={['#FFE066', '#FF8C00', '#B03000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <Text style={[styles.streakNumber, { fontSize: streakFontSize, opacity: 0 }]}>
              {streakCount}
            </Text>
          </LinearGradient>
        </MaskedView>

        {/* 6. "DAY STREAK" Label */}
        <Text style={styles.dayStreakLabel}>DAY STREAK</Text>

        {/* 7. Milestone Badge */}
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeEmoji}>{milestone.emoji}</Text>
          <Text style={styles.badgeText}>{milestone.text}</Text>
        </View>

        {/* 8. Divider */}
        <View style={styles.divider} />

        {/* 9. Tagline */}
        <Text style={styles.taglineBody}>
          Building a <Text style={styles.taglineEmphasis}>consistent relationship</Text>{'\n'}
          with the Quran,{'\n'}
          one day at a time.
        </Text>
      </View>

      {/* 10. Brand Bar */}
      <View style={styles.brandBar}>
        <View style={styles.brandLeft}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.appIcon}
          />
          <View>
            <Text style={styles.brandName}>iHafidh</Text>
            <Text style={styles.brandSub}>Your Quran Companion</Text>
          </View>
        </View>
        <View style={styles.brandRight}>
          <View style={styles.storePill}>
            <Icon name="apple" size={10} color="#7A6F8F" />
            <Text style={styles.storeText}>App Store</Text>
          </View>
          <View style={styles.storePill}>
            <Icon name="google-play" size={10} color="#7A6F8F" />
            <Text style={styles.storeText}>Google Play</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: 380,
    height: 520,
    backgroundColor: '#12101C',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#2A2040',
    overflow: 'hidden',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
  },
  topAccentLine: {
    height: 3,
    width: '100%',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 32,
    position: 'relative',
  },
  glowFallback: {
    position: 'absolute',
    top: 50,
    width: 160,
    height: 160,
    backgroundColor: '#FF8C00',
    borderRadius: 80,
    opacity: 0.15,
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 60,
    elevation: 20,
  },
  flameShadow: {
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 16,
    elevation: 24,
    marginBottom: 8,
  },
  streakNumberMask: {
    fontWeight: '900',
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: undefined,
  },
  streakNumber: {
    fontWeight: '900',
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: undefined,
  },
  dayStreakLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF8C00',
    letterSpacing: 2,
    marginTop: -8,
    marginBottom: 16,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,140,0,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,140,0,0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  badgeEmoji: {
    fontSize: 14,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFB347',
    letterSpacing: 1,
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: '#2A2040',
    marginTop: 24,
    marginBottom: 20,
  },
  taglineBody: {
    fontSize: 15,
    color: '#7A6F8F',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '300',
  },
  taglineEmphasis: {
    color: '#C8BFDA',
    fontWeight: '600',
  },
  brandBar: {
    height: 76,
    width: '100%',
    backgroundColor: 'rgba(255,140,0,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#2A2040',
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2040',
  },
  brandName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E8E0F0',
  },
  brandSub: {
    fontSize: 11,
    color: '#5A5070',
    marginTop: 2,
  },
  brandRight: {
    gap: 6,
  },
  storePill: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#1E192B',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2A2040',
    alignItems: 'center',
  },
  storeText: {
    fontSize: 9,
    color: '#7A6F8F',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
