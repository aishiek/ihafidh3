import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Defs, RadialGradient, Stop, Path, LinearGradient as SvgLinearGradient, Circle, G } from 'react-native-svg';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getStreakTheme, StreakMilestoneTheme } from '@/constants/streakThemes';

interface StreakShareCardProps {
  streakCount: number;
}

const DynamicFlameIcon = ({ size = 84, theme }: { size?: number; theme: StreakMilestoneTheme }) => (
  <View style={[styles.flameShadow, { shadowColor: theme.glowColor }]}>
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Defs>
        <SvgLinearGradient id="streakFlameGrad" x1="0" y1="100" x2="0" y2="0" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor={theme.flameColors[0]} />
          <Stop offset="32%" stopColor={theme.flameColors[1]} />
          <Stop offset="68%" stopColor={theme.flameColors[2]} />
          <Stop offset="100%" stopColor={theme.flameColors[3]} />
        </SvgLinearGradient>
        <SvgLinearGradient id="innerFlameGrad" x1="0" y1="90" x2="0" y2="25" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor={theme.flameColors[1]} />
          <Stop offset="50%" stopColor={theme.flameColors[2]} />
          <Stop offset="100%" stopColor={theme.flameColors[3]} />
        </SvgLinearGradient>
        <RadialGradient id="flameCoreGlow" cx="50%" cy="75%" r="35%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.9} />
          <Stop offset="45%" stopColor={theme.secondaryColor} stopOpacity={0.7} />
          <Stop offset="100%" stopColor={theme.primaryColor} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Outer Flame Silhouette */}
      <Path
        d="M50 4C50 4 20 34 20 61C20 77.5685 33.4315 91 50 91C66.5685 91 80 77.5685 80 61C80 34 50 4 50 4Z"
        fill="url(#streakFlameGrad)"
      />

      {/* Mid Flame Core */}
      <Path
        d="M50 28C50 28 33 49 33 66C33 75.3888 40.6112 83 50 83C59.3888 83 67 75.3888 67 66C67 49 50 28 50 28Z"
        fill="url(#innerFlameGrad)"
        opacity="0.88"
      />

      {/* Luminous Hot Center */}
      <Path
        d="M50 46C50 46 41 59 41 70C41 74.9706 45.0294 79 50 79C54.9706 79 59 74.9706 59 70C59 59 50 46 50 46Z"
        fill="url(#flameCoreGlow)"
      />
    </Svg>
  </View>
);

/**
 * Geometric Islamic Octagram watermark in the background
 */
const IslamicPatternWatermark = ({ color }: { color: string }) => (
  <View style={styles.watermarkContainer} pointerEvents="none">
    <Svg width={240} height={240} viewBox="0 0 200 200" fill="none">
      <G opacity={0.06} stroke={color} strokeWidth={1.5}>
        <Circle cx="100" cy="100" r="85" />
        <Circle cx="100" cy="100" r="60" />
        <Path d="M100 15 L185 100 L100 185 L15 100 Z" />
        <Path d="M40 40 L160 40 L160 160 L40 160 Z" />
        <Path d="M100 30 L170 100 L100 170 L30 100 Z" strokeDasharray="3 3" />
      </G>
    </Svg>
  </View>
);

export const StreakShareCard: React.FC<StreakShareCardProps> = ({ streakCount }) => {
  const theme = getStreakTheme(streakCount);
  const digitCount = streakCount.toString().length;
  const streakFontSize = digitCount > 3 ? 68 : digitCount > 2 ? 88 : 108;

  return (
    <View style={[styles.cardContainer, { borderColor: `rgba(${theme.rgba}, 0.35)` }]}>
      {/* Background Dark Gradient */}
      <LinearGradient
        colors={['#0D0B14', '#161226', '#090710']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Subtle Islamic Geometry Watermark */}
      <IslamicPatternWatermark color={theme.primaryColor} />

      {/* Top Accent Gradient Line */}
      <LinearGradient
        colors={theme.accentGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topAccentLine}
      />

      <View style={styles.content}>
        {/* Ambient Halo Glow behind Flame */}
        <View
          style={[
            styles.glowOuterHalo,
            { backgroundColor: theme.glowColor, shadowColor: theme.glowColor }
          ]}
        />
        <View
          style={[
            styles.glowCoreHalo,
            { backgroundColor: theme.secondaryColor, shadowColor: theme.secondaryColor }
          ]}
        />

        {/* Dynamic Flame Graphic */}
        <DynamicFlameIcon size={84} theme={theme} />

        {/* Streak Number (High Impact Gradient Text) */}
        <MaskedView
          maskElement={
            <Text style={[styles.streakNumberMask, { fontSize: streakFontSize }]}>
              {streakCount}
            </Text>
          }
        >
          <LinearGradient
            colors={theme.textGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <Text style={[styles.streakNumber, { fontSize: streakFontSize, opacity: 0 }]}>
              {streakCount}
            </Text>
          </LinearGradient>
        </MaskedView>

        {/* DAY STREAK Label */}
        <View style={styles.dayStreakWrap}>
          <Text style={[styles.dayStreakLabel, { color: theme.primaryColor }]}>
            DAY STREAK
          </Text>
        </View>

        {/* Milestone Tier Badge */}
        <View
          style={[
            styles.badgeContainer,
            {
              backgroundColor: `rgba(${theme.rgba}, 0.12)`,
              borderColor: `rgba(${theme.rgba}, 0.38)`,
            }
          ]}
        >
          <Text style={styles.badgeEmoji}>{theme.badgeEmoji}</Text>
          <Text style={[styles.badgeText, { color: theme.secondaryColor }]}>
            {theme.badgeTitle}
          </Text>
        </View>

        {/* Luminous Gradient Divider */}
        <LinearGradient
          colors={['transparent', `rgba(${theme.rgba}, 0.5)`, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.divider}
        />

        {/* Tagline */}
        <Text style={styles.taglineBody}>
          Building a <Text style={[styles.taglineEmphasis, { color: theme.secondaryColor }]}>consistent relationship</Text>{'\n'}
          with the Noble Quran,{'\n'}
          one day at a time.
        </Text>
      </View>

      {/* Brand Bar Footer */}
      <View
        style={[
          styles.brandBar,
          {
            backgroundColor: `rgba(${theme.rgba}, 0.05)`,
            borderTopColor: `rgba(${theme.rgba}, 0.22)`,
          }
        ]}
      >
        <View style={styles.brandLeft}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={[styles.appIcon, { borderColor: `rgba(${theme.rgba}, 0.4)` }]}
          />
          <View>
            <Text style={styles.brandName}>iHafidh</Text>
            <Text style={styles.brandSub}>Your Quran Companion</Text>
          </View>
        </View>
        <View style={styles.brandRight}>
          <View style={[styles.storePill, { borderColor: `rgba(${theme.rgba}, 0.25)` }]}>
            <Icon name="apple" size={11} color="#A79FB8" />
            <Text style={styles.storeText}>App Store</Text>
          </View>
          <View style={[styles.storePill, { borderColor: `rgba(${theme.rgba}, 0.25)` }]}>
            <Icon name="google-play" size={10} color="#A79FB8" />
            <Text style={styles.storeText}>Google Play</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default StreakShareCard;

const styles = StyleSheet.create({
  cardContainer: {
    width: 380,
    height: 520,
    backgroundColor: '#0D0B14',
    borderRadius: 28,
    borderWidth: 1.5,
    overflow: 'hidden',
    elevation: 20,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.4,
    shadowRadius: 28,
    position: 'relative',
  },
  watermarkContainer: {
    position: 'absolute',
    top: 30,
    alignSelf: 'center',
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topAccentLine: {
    height: 4,
    width: '100%',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 28,
    position: 'relative',
  },
  glowOuterHalo: {
    position: 'absolute',
    top: 24,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.14,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 50,
    elevation: 20,
  },
  glowCoreHalo: {
    position: 'absolute',
    top: 48,
    width: 110,
    height: 110,
    borderRadius: 55,
    opacity: 0.24,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 22,
  },
  flameShadow: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.85,
    shadowRadius: 20,
    elevation: 26,
    marginBottom: 4,
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
  dayStreakWrap: {
    marginTop: -8,
    marginBottom: 12,
  },
  dayStreakLabel: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 22,
    gap: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  badgeEmoji: {
    fontSize: 15,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  divider: {
    width: 140,
    height: 1.5,
    marginTop: 18,
    marginBottom: 14,
  },
  taglineBody: {
    fontSize: 14,
    color: '#8E85A3',
    textAlign: 'center',
    lineHeight: 21,
    fontWeight: '300',
  },
  taglineEmphasis: {
    fontWeight: '700',
  },
  brandBar: {
    height: 74,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    borderTopWidth: 1,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  brandSub: {
    fontSize: 11,
    color: '#7D7392',
    marginTop: 2,
    fontWeight: '500',
  },
  brandRight: {
    gap: 6,
  },
  storePill: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  storeText: {
    fontSize: 9,
    color: '#A79FB8',
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
