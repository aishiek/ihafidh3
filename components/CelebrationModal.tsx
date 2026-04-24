import { useSettingsStore } from '@/store/settingsStore';
import { getArabicTypographySizing } from '@/utils/fontUtils';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View, Modal, TouchableOpacity } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { router } from 'expo-router';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Performance monitoring flag - set to true to log FPS data
const ENABLE_PERFORMANCE_LOGGING = __DEV__;

export type CelebrationType = 'quiz' | 'surah-memorized' | 'juz-memorized' | 'surah-revised' | 'juz-revised' | 'badge-unlocked' | 'hafidh-badge';

export interface CelebrationMessage {
  arabic: string;
  english: string;
  emoji: string;
}

const CELEBRATION_MESSAGES: Record<CelebrationType, CelebrationMessage[]> = {
  quiz: [
    {
      arabic: "ما شاء الله!",
      english: "You've unlocked the light of the Qur'an in your heart — may it guide you always.",
      emoji: "🌟"
    },
    {
      arabic: "بارك الله فيك!",
      english: "Every verse you've memorized is a treasure in your scales — keep going!",
      emoji: "📖"
    },
    {
      arabic: "الحمد لله!",
      english: "You've taken a step closer to Jannah — may Allah keep you steadfast.",
      emoji: "✨"
    },
    {
      arabic: "ما شاء الله!",
      english: "The words of Allah now live in your memory — may they flourish in your actions.",
      emoji: "🌹"
    },
    {
      arabic: "الله أكبر!",
      english: "You've honored the Qur'an — may it honor you on the Day of Judgment.",
      emoji: "🕋"
    },
    {
      arabic: "أحسنت!",
      english: "With each verse, you're building a fortress of light around your soul.",
      emoji: "🌙"
    },
    {
      arabic: "سبحان الله!",
      english: "May every word you've memorized intercede for you and raise your rank.",
      emoji: "📿"
    },
    {
      arabic: "بارك الله فيك!",
      english: "You're not just learning — you're carrying the legacy of revelation.",
      emoji: "🔥"
    }
  ],
  'surah-memorized': [
    {
      arabic: "ما شاء الله!",
      english: "You've completed an entire Surah! May it be a light for you in this life and the next.",
      emoji: "📗"
    },
    {
      arabic: "الله أكبر!",
      english: "A full Surah in your heart! May Allah crown you with it on the Day of Judgment.",
      emoji: "👑"
    },
    {
      arabic: "بارك الله فيك!",
      english: "You've memorized a complete Surah — may it intercede for you in Paradise.",
      emoji: "🌟"
    },
    {
      arabic: "أحسنت!",
      english: "Every verse of this Surah is now a treasure in your soul. Keep going!",
      emoji: "💎"
    },
    {
      arabic: "الحمد لله!",
      english: "A complete Surah memorized! You're carrying the words of your Creator.",
      emoji: "✨"
    }
  ],
  'juz-memorized': [
    {
      arabic: "الله أكبر!",
      english: "You've memorized an entire Juz! May Allah elevate your rank in Jannah.",
      emoji: "🌙"
    },
    {
      arabic: "ما شاء الله!",
      english: "A full Juz in your heart! May it be a shield from the fire for you.",
      emoji: "🛡️"
    },
    {
      arabic: "سبحان الله!",
      english: "You've completed a Juz! The angels are recording your incredible achievement.",
      emoji: "📜"
    },
    {
      arabic: "بارك الله فيك!",
      english: "An entire Juz memorized! You're walking the path of the Huffadh.",
      emoji: "🚀"
    },
    {
      arabic: "الحمد لله!",
      english: "A Juz complete! May Allah make you among those He honors with His Book.",
      emoji: "👑"
    }
  ],
  'surah-revised': [
    {
      arabic: "أحسنت!",
      english: "You've revised the entire Surah! Consistency is the key to preserving your Hifdh.",
      emoji: "🔄"
    },
    {
      arabic: "بارك الله فيك!",
      english: "Complete Surah revision! You're keeping the words of Allah fresh in your heart.",
      emoji: "💚"
    },
    {
      arabic: "ما شاء الله!",
      english: "Surah revision complete! May Allah make it easy for you to maintain your Hifdh.",
      emoji: "✅"
    },
    {
      arabic: "الحمد لله!",
      english: "You've refreshed an entire Surah! Your dedication is truly inspiring.",
      emoji: "🌟"
    }
  ],
  'juz-revised': [
    {
      arabic: "الله أكبر!",
      english: "You've revised a full Juz! Your commitment to your Hifdh is remarkable.",
      emoji: "🔄"
    },
    {
      arabic: "ما شاء الله!",
      english: "Complete Juz revision! You're protecting your treasure with diligence.",
      emoji: "💎"
    },
    {
      arabic: "بارك الله فيك!",
      english: "A full Juz revised! May Allah strengthen your memory and preserve your Hifdh.",
      emoji: "💪"
    },
    {
      arabic: "سبحان الله!",
      english: "Juz revision complete! Your consistency will be rewarded in both worlds.",
      emoji: "⭐"
    }
  ],
  'badge-unlocked': [
    {
      arabic: "ما شاء الله تبارك الله!",
      english: "You've earned a new badge! Your dedication to the Qur'an is truly inspiring.",
      emoji: "🏆"
    },
    {
      arabic: "الله أكبر!",
      english: "Achievement unlocked! May Allah continue to bless your journey with His Book.",
      emoji: "⭐"
    },
    {
      arabic: "بارك الله فيك!",
      english: "A new milestone reached! The angels are celebrating with you.",
      emoji: "🎖️"
    },
    {
      arabic: "سبحان الله!",
      english: "You've reached a new level! Every step brings you closer to Allah.",
      emoji: "🌟"
    },
    {
      arabic: "الحمد لله!",
      english: "Badge earned! Your perseverance is building a palace in Jannah.",
      emoji: "🏅"
    },
    {
      arabic: "أحسنت!",
      english: "New achievement unlocked! You're writing your legacy one verse at a time.",
      emoji: "✨"
    },
    {
      arabic: "ما شاء الله!",
      english: "Congratulations! May this achievement be heavy on your scales on the Day of Judgment.",
      emoji: "💫"
    },
    {
      arabic: "تبارك الله!",
      english: "You've earned a new honor! Keep climbing the ranks of the People of the Qur'an.",
      emoji: "🎯"
    }
  ],
  'hafidh-badge': [
    {
      arabic: "اللهم صل على محمد وعلى آل محمد!",
      english: "Subhan'Allah! You are now a Hafidh of the entire Qur'an! The Prophet ﷺ will intercede for you!",
      emoji: "👑"
    },
    {
      arabic: "الله أكبر! الله أكبر! الله أكبر!",
      english: "You've completed the most noble journey! You are crowned as a Guardian of the Qur'an!",
      emoji: "🕋"
    },
    {
      arabic: "ما شاء الله تبارك الرحمن!",
      english: "Allahu Akbar! You've memorized all 6,236 verses! You are among the elite Huffadh!",
      emoji: "📿"
    },
    {
      arabic: "سبحان الله العظيم!",
      english: "The entire Qur'an lives in your heart! May it be a light, proof, and intercession for you!",
      emoji: "✨"
    },
    {
      arabic: "الحمد لله رب العالمين!",
      english: "You've reached the pinnacle! A crown of honor awaits you in Paradise for every verse!",
      emoji: "👑"
    },
    {
      arabic: "بارك الله فيك يا حافظ القرآن!",
      english: "Ya Hafidh al-Qur'an! You carry the greatest treasure - may Allah preserve it in your heart forever!",
      emoji: "💎"
    },
    {
      arabic: "ما أعظم هذا الإنجاز!",
      english: "You are now from Ahl al-Qur'an - the People of Allah! The noblest of all people!",
      emoji: "🌙"
    },
    {
      arabic: "اللهم اجعله من أهل القرآن!",
      english: "Complete Hifdh achieved! On Judgement Day, you'll be told: 'Recite and ascend!' Allahu Akbar!",
      emoji: "🚀"
    }
  ]
};

// Custom Confetti Piece Component
const ConfettiPiece = ({ delay, duration, startX, startY }: { 
  delay: number; 
  duration: number; 
  startX: number; 
  startY: number; 
}) => {
  const translateY = useRef(new Animated.Value(startY)).current;
  const translateX = useRef(new Animated.Value(startX)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
  const color = colors[Math.floor(Math.random() * colors.length)];

  useEffect(() => {
    // Animate falling confetti
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT + 100,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: startX + (Math.random() - 0.5) * 200,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: Math.random() > 0.5 ? 360 : -360,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: duration,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      })
    ]).start();
  }, [delay, duration, translateY, translateX, rotate, opacity, startX, startY]);

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        {
          backgroundColor: color,
          left: 0,
          top: 0,
          transform: [
            { translateX },
            { translateY },
            { rotate: rotate.interpolate({
              inputRange: [0, 360],
              outputRange: ['0deg', '360deg'],
            }) },
          ],
          opacity,
        },
      ]}
    />
  );
};

// Confetti configuration per celebration type
const CONFETTI_CONFIG: Record<CelebrationType, { 
  count: number; 
  duration: number; 
  useLibrary: boolean;
  colors: string[];
}> = {
  quiz: { 
    count: 250, 
    duration: 5000, 
    useLibrary: true, // Now using library for more punchy celebration
    colors: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#FF1493', '#00CED1']
  },
  'surah-memorized': { 
    count: 150, 
    duration: 4000, 
    useLibrary: true, // Library for bigger celebrations
    colors: ['#FFD700', '#4ECDC4', '#FF6B6B', '#45B7D1', '#96CEB4']
  },
  'juz-memorized': { 
    count: 200, 
    duration: 5000, 
    useLibrary: true,
    colors: ['#FFD700', '#FFA500', '#4ECDC4', '#FF6B6B', '#45B7D1', '#96CEB4', '#FFEAA7']
  },
  'surah-revised': { 
    count: 100, 
    duration: 3500, 
    useLibrary: true,
    colors: ['#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']
  },
  'juz-revised': { 
    count: 120, 
    duration: 4000, 
    useLibrary: true,
    colors: ['#FFD700', '#4ECDC4', '#45B7D1', '#96CEB4']
  },
  'badge-unlocked': { 
    count: 250, 
    duration: 5000, 
    useLibrary: true,
    colors: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#FF1493', '#00CED1']
  },
  'hafidh-badge': { 
    count: 500, // MAXIMUM CONFETTI!
    duration: 8000, // Longer celebration
    useLibrary: true,
    colors: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#FF1493', '#00CED1', '#FFD700', '#FFA500', '#FFD700'] // More gold!
  },
};

interface CelebrationModalProps {
  visible: boolean;
  type: CelebrationType;
  customMessage?: CelebrationMessage;
  badgeName?: string; // For displaying badge name prominently
  onComplete?: () => void;
}

export default function CelebrationModal({ 
  visible, 
  type, 
  customMessage,
  badgeName,
  onComplete 
}: CelebrationModalProps) {
  const { arabicFont, fontSizeArabic } = useSettingsStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const [confettiError, setConfettiError] = React.useState(false);
  
  const arabicTypography = getArabicTypographySizing(fontSizeArabic * 1.2, arabicFont as any);
  const confettiConfig = CONFETTI_CONFIG[type];
  
  // Select message: custom message or random from type
  const message = React.useMemo(() => {
    if (customMessage) return customMessage;
    const messages = CELEBRATION_MESSAGES[type];
    return messages[Math.floor(Math.random() * messages.length)];
  }, [visible, type, customMessage]);
  
  const getArabicFontFamily = () => {
    switch (arabicFont) {
      case 'uthman-taha':
        return 'UthmanTaha-Ver10';
      case 'amiri-quran':
        return 'AmiriQuran-Regular';
      case 'scheherazade':
        return 'ScheherazadeNew-Regular';
      case 'scheherazade-bold':
        return 'ScheherazadeNew-Bold';
      case 'indo-pak':
        return 'NooreHuda-Regular';
      default:
        return 'UthmanTaha-Ver10';
    }
  };

  useEffect(() => {
    if (visible) {
      if (__DEV__) {
        console.log(`🎉 [CelebrationModal] MODAL NOW VISIBLE - type: ${type}, badge: ${badgeName || 'none'}`);
        const method = confettiConfig.useLibrary ? 'react-native-confetti-cannon' : 'custom';
        console.log(`🎊 [Celebration] Starting ${type} celebration with ${method} confetti (${confettiConfig.count} pieces)`);
        if (badgeName) {
          console.log(`🏆 [Celebration] Badge: ${badgeName}`);
        }
      }
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.3);
      setConfettiError(false); // Reset error state

      // Start fade-in and scale animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after confetti duration
      const dismissTimer = setTimeout(() => {
        if (__DEV__) console.log(`⏱️ [CelebrationModal] Auto-dismissing after ${confettiConfig.duration}ms`);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (onComplete) {
            onComplete();
          }
        });
      }, confettiConfig.duration);

      return () => {
        clearTimeout(dismissTimer);
      };
    }
  }, [visible, fadeAnim, scaleAnim, onComplete, confettiConfig, type, badgeName]);

  if (!visible) {
    if (__DEV__) console.log(`❌ [CelebrationModal] Modal hidden - visible is false`);
    return null;
  }

  if (__DEV__) console.log(`✅ [CelebrationModal] RENDERING MODAL - type: ${type}, badge: ${badgeName || 'none'}`);

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="none"
    >
      <View 
        style={[
          styles.modalOverlay, 
          { 
            zIndex: 999999,
            elevation: 999999,
          }
        ]}
        pointerEvents="auto"
      >
      <View style={styles.overlay}>
        <View style={[styles.confettiContainer, { zIndex: 99999 }]}>
          {confettiConfig.useLibrary && !confettiError ? (
            // Try using library confetti first
            <ConfettiCannon
              key={`confetti-${type}-${visible ? Date.now() : 0}`}
              count={confettiConfig.count}
              origin={{ x: SCREEN_WIDTH / 2, y: -50 }}
              autoStart={true}
              autoStartDelay={100}
              fadeOut={false}
              fallSpeed={4000}
              colors={confettiConfig.colors}
              explosionSpeed={500}
              onAnimationEnd={() => __DEV__ && console.log('✅ [Confetti] Animation completed')}
            />
          ) : (
            // Fallback to custom confetti if library fails or for quiz type
            Array.from({ length: confettiError ? Math.min(confettiConfig.count, 150) : confettiConfig.count }, (_, index) => (
              <ConfettiPiece
                key={`confetti-${index}-${visible ? Date.now() : 0}`}
                delay={Math.random() * 1000}
                duration={2500 + Math.random() * 2000}
                startX={SCREEN_WIDTH / 2 + (Math.random() - 0.5) * 100}
                startY={-50}
              />
            ))
          )}
        </View>
        <Animated.View
          style={[
            styles.messageBox,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {__DEV__ && (
            <View style={styles.debugIndicator}>
              <Text style={styles.debugText}>
                {confettiConfig.useLibrary ? '🎉 Library' : '✨ Custom'} | {confettiConfig.count}pc
              </Text>
            </View>
          )}
          <Text style={styles.emoji}>{message.emoji}</Text>
          {badgeName && (type === 'badge-unlocked' || type === 'hafidh-badge') && (
            <Text style={styles.badgeName}>{badgeName}</Text>
          )}
          <Text style={[styles.arabic, { 
            fontFamily: getArabicFontFamily(),
            includeFontPadding: false,
            ...arabicTypography
          }]}>{message.arabic}</Text>
          <Text style={styles.english}>{message.english}</Text>
          
          {(type === 'badge-unlocked' || type === 'hafidh-badge') && (
            <TouchableOpacity 
              style={styles.viewBadgesBtn}
              onPress={() => {
                if (onComplete) onComplete();
                router.push('/(tabs)/badges');
              }}
            >
              <Text style={styles.viewBadgesText}>View your badges</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.continueBtn}
            onPress={() => {
              if (onComplete) onComplete();
            }}
          >
            <Text style={styles.continueText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    pointerEvents: 'none',
    zIndex: 99999, // Ensure confetti appears on top
  },
  confettiPiece: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 6,
    zIndex: 2,
  },
  messageBox: {
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 40,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    zIndex: 99998, // Below confetti but above overlay
  },
  emoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  badgeName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  arabic: {
    fontSize: 28,
    color: '#FFD700',
    marginBottom: 8,
    textAlign: 'center',
  },
  english: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 22,
  },
  debugIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  debugText: {
    fontSize: 10,
    color: '#FFD700',
    fontWeight: '600',
  },
  viewBadgesBtn: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#FFD700',
    borderRadius: 20,
  },
  viewBadgesText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  continueBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  continueText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});