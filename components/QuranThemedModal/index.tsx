import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { AccessibilityInfo, I18nManager, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styles, { ACCENTS, GRADIENTS, TIMINGS } from './QuranThemedModal.styles';
import type QuranThemedModalProps from './QuranThemedModal.types';

// Lazy-load local svg assets
const SajdahIcon = React.lazy(() => import('@/assets/svg/islamic-patterns/SajdahIcon'));
const MosqueIcon = React.lazy(() => import('@/assets/svg/islamic-patterns/MosqueIcon'));
const QuranIcon = React.lazy(() => import('@/assets/svg/islamic-patterns/QuranIcon'));
const CrescentMoon = React.lazy(() => import('@/assets/svg/islamic-patterns/CrescentMoon'));
const ArabesqueTop = React.lazy(() => import('@/assets/svg/islamic-patterns/ArabesqueTop'));
const IslamicDivider = React.lazy(() => import('@/assets/svg/islamic-patterns/IslamicDivider'));
const StarPattern = React.lazy(() => import('@/assets/svg/islamic-patterns/StarPattern'));

function pickGradient(variant?: QuranThemedModalProps['variant'], custom?: [string, string]) {
  if (variant === 'custom' && custom && custom.length === 2) return custom;
  return GRADIENTS[variant || 'default'] || GRADIENTS.default;
}

function IconFromKey({ keyName, color, size = 48 }: { keyName?: string; color?: string; size?: number }) {
  if (!keyName) return null;
  const props = { size, color } as any;
  switch (keyName) {
    case 'sajdah':
      return (
        <React.Suspense fallback={<View style={{ width: size, height: size }} />}> <SajdahIcon {...props} /> </React.Suspense>
      );
    case 'mosque':
      return (
        <React.Suspense fallback={<View style={{ width: size, height: size }} />}> <MosqueIcon {...props} /> </React.Suspense>
      );
    case 'quran':
      return (
        <React.Suspense fallback={<View style={{ width: size, height: size }} />}> <QuranIcon {...props} /> </React.Suspense>
      );
    case 'star':
      return (
        <React.Suspense fallback={<View style={{ width: size, height: size }} />}> <CrescentMoon {...props} /> </React.Suspense>
      );
    case 'trophy':
      // Fall back to CrescentMoon if trophy isn't present
      return (
        <React.Suspense fallback={<View style={{ width: size, height: size }} />}> <CrescentMoon {...props} /> </React.Suspense>
      );
    default:
      return null;
  }
}

const AnimatedBlur: any = Animated.createAnimatedComponent(BlurView as any);

export default function QuranThemedModal(props: QuranThemedModalProps) {
  const {
    visible,
    onClose,
    variant = 'default',
    customGradient,
    icon,
    customIcon,
    iconColor,
    showIconGlow = false,
    title,
    subtitle,
    arabicText,
    arabicTranslation,
    bodyText,
    children,
    badges,
    showTopOrnament = false,
    showDivider = false,
    showStarPattern = false,
    primaryButton,
    secondaryButton,
    tertiaryButton,
    dismissable = true,
    closeOnPrimaryPress = true,
    closeOnSecondaryPress = true,
    animationDuration = TIMINGS.enter,
    accessibilityLabel,
    testID,
  } = props;

  const { theme: themeColors } = useUnifiedTheme();
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = React.useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => setReduceMotion(v));
  }, []);

  const grad = pickGradient(variant, customGradient);

  // animation state
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      progress.value = withTiming(1, { duration: reduceMotion ? 1 : animationDuration, easing: Easing.out(Easing.exp) });
      // haptic on open
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } else {
      progress.value = withTiming(0, { duration: reduceMotion ? 1 : TIMINGS.exit, easing: Easing.in(Easing.exp) });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.72])
  }));

  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(progress.value ? 1 : 0.92) }],
    opacity: progress.value
  }));

  const iconPulse = useAnimatedStyle(() => ({
    transform: [{ scale: 0.98 + (progress.value * 0.02) }],
    opacity: 0.9 + (progress.value * 0.1)
  }));

  const handlePrimary = async () => {
    if (primaryButton?.onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      try { primaryButton.onPress(); } catch (e) { console.warn(e); }
    }
    if (closeOnPrimaryPress) onClose?.();
  };

  const handleSecondary = async () => {
    if (secondaryButton?.onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      try { secondaryButton.onPress(); } catch (e) { console.warn(e); }
    }
    if (closeOnSecondaryPress) onClose?.();
  };

  const contentIsRTL = I18nManager.isRTL;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => dismissable && onClose?.()}
      statusBarTranslucent
      presentationStyle="overFullScreen"
      accessibilityViewIsModal
      accessible
      accessibilityLabel={accessibilityLabel || title}
      testID={testID}
    >
      <AnimatedBlur tint="dark" intensity={60} style={[{ flex: 1, justifyContent: 'center', alignItems: 'center' }, backdropStyle] as any}>
        {/* Decorative star pattern */}
        {showStarPattern ? (
          <React.Suspense fallback={null}><StarPattern /></React.Suspense>
        ) : null}

        <Pressable
          style={{ position: 'absolute', width: '100%', height: '100%' }}
          onPress={() => dismissable && onClose?.()}
          accessibilityLabel="Dismiss modal backdrop"
        />

        <Animated.View style={[styles.modalContainer, { marginTop: insets.top + 20 }, modalStyle]}>
          <LinearGradient colors={[grad[0], grad[1]]} start={[0, 0]} end={[1, 1]} style={{ borderRadius: 20 }}>
            {/* Top ornament */}
            {showTopOrnament && (
              <React.Suspense fallback={<View style={{ height: 40 }} />}>
                <ArabesqueTop style={styles.ornamentTop} />
              </React.Suspense>
            )}

            {/* Icon */}
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 12 }}>
              <Animated.View style={[styles.iconWrap, { backgroundColor: iconColor || 'rgba(255,255,255,0.06)' }, iconPulse as any]}>
                {customIcon ? customIcon : <IconFromKey keyName={icon} color={iconColor || '#fff'} size={44} />}
              </Animated.View>
            </View>

            <View style={styles.contentInner}>
              <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
              {subtitle ? <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>{subtitle}</Text> : null}

              {/* Badges */}
              {Array.isArray(badges) && badges.length > 0 && (
                <View style={styles.badgesWrap} accessibilityRole="list">
                  {badges.map((b, idx) => (
                    <View key={idx} style={[styles.badgePill, { backgroundColor: 'rgba(255,255,255,0.06)' }]}> 
                      {b.icon ? b.icon : null}
                      <Text style={{ color: themeColors.text, fontSize: 12, marginLeft: b.icon ? 6 : 0 }}>{b.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Divider or other decoration */}
              {showDivider && (
                <View style={styles.dividerWrap}>
                  <React.Suspense fallback={<View style={{ height: 12 }} />}>
                    <IslamicDivider />
                  </React.Suspense>
                </View>
              )}

              {/* Arabic text */}
              {arabicText ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.arabicText, { color: themeColors.text }]} accessible importantForAccessibility={contentIsRTL ? 'yes' : 'no'}>{arabicText}</Text>
                  {arabicTranslation ? <Text style={[styles.arabicTranslation, { color: themeColors.textSecondary }]}>{arabicTranslation}</Text> : null}
                </View>
              ) : null}

              {/* Body or children */}
              {bodyText ? <Text style={[styles.bodyText, { color: themeColors.textSecondary }]}>{bodyText}</Text> : null}
              {/* Render children safely: wrap any string/number child into a <Text>
                  so React Native doesn't try to place bare text inside Views */}
              {React.Children.count(children) > 0 ? (
                React.Children.map(children, (c) => {
                  if (c === null || c === undefined) return null;
                  if (typeof c === 'string' || typeof c === 'number') {
                    return (
                      <Text style={[styles.bodyText, { color: themeColors.textSecondary }]}>
                        {String(c)}
                      </Text>
                    );
                  }
                  return c as React.ReactNode;
                })
              ) : null}

              {/* buttons */}
              <View style={{ marginTop: 14, paddingHorizontal: 12 }}>
                {primaryButton ? (
                  <TouchableOpacity
                    accessible
                    accessibilityRole="button"
                    onPress={handlePrimary}
                    style={[styles.actionFull, { backgroundColor: ACCENTS.gold, marginBottom: 12 }]}
                  >
                    <LinearGradient colors={[grad[1], grad[0]]} style={[{ width: '100%', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }]}>
                      <Text style={[styles.actionPrimaryText, { color: '#fff' }]}>{primaryButton.label}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : null}

                {secondaryButton ? (
                  <TouchableOpacity
                    accessible
                    accessibilityRole="button"
                    onPress={handleSecondary}
                    style={[styles.actionFull, { borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.14)', marginBottom: 8 }]}
                  >
                    <Text style={[styles.actionSecondaryText, { color: themeColors.text }]}>{secondaryButton.label}</Text>
                  </TouchableOpacity>
                ) : null}

                {tertiaryButton ? (
                  <Pressable onPress={() => tertiaryButton.onPress()} style={{ alignItems: 'center', padding: 8 }}>
                    <Text style={{ color: themeColors.tint, textDecorationLine: 'underline' }}>{tertiaryButton.label}</Text>
                  </Pressable>
                ) : null}
              </View>

            </View>
          </LinearGradient>
        </Animated.View>
      </AnimatedBlur>
    </Modal>
  );
}
