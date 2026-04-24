import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Modal, Platform, Pressable, Text, View, StyleSheet } from 'react-native';

export type ReviewTrigger = 'first_quiz' | 'tenth_quiz' | 'juz_completed' | 'badge_unlocked';

export interface SadaqahPromptProps {
  visible: boolean;
  trigger: ReviewTrigger;
  onClose: (didRate: boolean, neverAskAgain?: boolean) => void;
}

export default function SadaqahPrompt({ visible, trigger, onClose }: SadaqahPromptProps) {
  const getCopy = () => {
    switch (trigger) {
      case 'first_quiz':
        return {
          headline: "Masha'Allah!",
          body: "You've just completed your first quiz. If iHafidh is helping your hifdh journey, earning Sadaqah Jariyah is just a tap away — leave a review and help others find this app."
        };
      case 'tenth_quiz':
        return {
          headline: "10 quizzes — SubhanAllah!",
          body: "Your dedication is inspiring. Help other Muslims discover iHafidh by sharing a quick review. Every word is Sadaqah Jariyah."
        };
      case 'juz_completed':
        return {
          headline: "Juz complete — Alhamdulillah!",
          body: "You've completed a full Juz. If iHafidh has been part of your journey, please consider leaving a review — it helps more Muslims benefit."
        };
      case 'badge_unlocked':
        return {
          headline: "Masha'Allah, a new badge!",
          body: "You're making real progress. Help others on the same path by leaving a review — a small act with lasting reward."
        };
      default:
        return {
          headline: "Masha'Allah!",
          body: "If iHafidh is helping your hifdh journey, earning Sadaqah Jariyah is just a tap away — leave a review and help others find this app."
        };
    }
  };

  const copy = getCopy();

  React.useEffect(() => {
    if (visible) {
      const { logAnalyticsEvent } = require('@/utils/analyticsHelper');
      logAnalyticsEvent('review_prompt_shown', { trigger });
    }
  }, [visible, trigger]);

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <LinearGradient
          colors={['#1a1a1a', '#0a0a0a']}
          style={styles.container}
        >
          <Text style={styles.headline}>{copy.headline}</Text>
          <Text style={styles.body}>{copy.body}</Text>

          <Pressable
            style={styles.ctaButton}
            onPress={() => onClose(true)}
          >
            <Text style={styles.ctaText}>Leave a review — earn Sadaqah Jariyah</Text>
          </Pressable>

          <View style={styles.footerRow}>
            <Pressable onPress={() => onClose(false)} hitSlop={10} style={styles.footerAction}>
              <Text style={styles.dismissText}>Maybe later</Text>
            </Pressable>
            <Text style={styles.footerSeparator}>•</Text>
            <Pressable onPress={() => onClose(false, true)} hitSlop={10} style={styles.footerAction}>
              <Text style={styles.dismissText}>Never ask again</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 32, // Provide space from the bottom edge
  },
  container: {
    width: '100%',
    maxWidth: 600,
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: '#D4AF3740', // Gold border with opacity
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  headline: {
    color: '#D4AF37', // Gold
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    color: '#E2E8F0', // slate-200
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 28,
  },
  ctaButton: {
    backgroundColor: '#D4AF37',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  footerAction: {
    paddingVertical: 8,
  },
  footerSeparator: {
    color: '#475569',
    fontSize: 14,
  },
  dismissText: {
    color: '#94A3B8', // slate-400
    fontSize: 14,
    fontWeight: '500',
  },
});
