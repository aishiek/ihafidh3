import { useSettingsStore } from '@/store/settingsStore';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, StyleSheet, Text, View } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ISLAMIC_MESSAGES = [
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
];

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
          toValue: startX + (Math.random() - 0.5) * 200, // Add some horizontal drift
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

export default function QuranQuizCelebration({ visible, onComplete }: { visible: boolean; onComplete?: () => void }) {
  const { arabicFont, fontSizeArabic } = useSettingsStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  
  // Randomly select a message when celebration becomes visible
  const message = React.useMemo(() => 
    ISLAMIC_MESSAGES[Math.floor(Math.random() * ISLAMIC_MESSAGES.length)], 
    [visible]
  );
  
  // Helper function to get Arabic font family (same as VerseItem)
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
      case 'tajweed':
        return 'ScheherazadeNew-Regular';
      case 'indo-pak':
        return 'NooreHuda-Regular';
      default:
        return 'UthmanTaha-Ver10';
    }
  };

  useEffect(() => {
    if (visible) {
      console.log('Celebration modal becoming visible');
      // Reset animations to initial state
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.3);
      
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

      const timer = setTimeout(() => {
        console.log('Celebration timer completed, starting fade out');
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
          console.log('Celebration fade out completed, calling onComplete');
          if (visible && onComplete) {
            try {
              onComplete();
            } catch (error) {
              console.error('Error in celebration completion:', error);
            }
          }
        });
      }, 4000);

      return () => {
        console.log('Cleaning up celebration timer');
        clearTimeout(timer);
      };
    }
  }, [visible, fadeAnim, scaleAnim, onComplete]);

  if (!visible) return null;

  // Generate 120 confetti pieces
  const confettiPieces = Array.from({ length: 120 }, (_, index) => (
    <ConfettiPiece
      key={index}
      delay={Math.random() * 1000}
      duration={2500 + Math.random() * 2000}
      startX={200 + (Math.random() - 0.5) * 100}
      startY={-50}
    />
  ));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onComplete}>
      <View style={styles.overlay}>
        <View style={styles.confettiContainer}>
          {confettiPieces}
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
          <Text style={styles.emoji}>{message.emoji}</Text>
          <Text style={[styles.arabic, { 
            fontFamily: getArabicFontFamily(),
            fontSize: fontSizeArabic * 1.2, // Slightly larger for celebration
            lineHeight: fontSizeArabic * 1.8
          }]}>{message.arabic}</Text>
          <Text style={styles.english}>{message.english}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  },
  confettiPiece: {
    position: 'absolute',
    width: 16, // larger for visibility
    height: 16,
    borderRadius: 4,
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
    zIndex: 1, // Ensure message appears above confetti
  },
  emoji: {
    fontSize: 48,
    marginBottom: 8,
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
});