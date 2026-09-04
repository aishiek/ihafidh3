import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { logAnalyticsEvent, logScreenView } from '@/utils/analyticsHelper';
import { Modal, Pressable, Text, View, StyleSheet } from 'react-native';

export type ReviewTrigger =
  | 'first_quiz' | 'fifth_quiz' | 'tenth_quiz' | 'twentieth_quiz'
  | 'juz_completed' | 'badge_unlocked'
  | 'surah_completed' | 'streak_milestone';

/**
 * Item 10 (Sept release): two-path sentiment gate.
 * - 'up'  → caller invokes the native App Store review flow.
 * - 'down' → caller routes to the in-app feedback screen. The native review
 *            dialog must NEVER be shown on this path (Apple prohibits gating
 *            their prompt on sentiment — but choosing whether to invoke it at
 *            all based on sentiment is explicitly allowed).
 * - 'dismissed' → user closed without answering ("Maybe later" / "Never ask again").
 */
export type SadaqahOutcome = 'up' | 'down' | 'dismissed';

export interface SadaqahPromptProps {
  visible: boolean;
  trigger: ReviewTrigger;
  onOutcome: (outcome: SadaqahOutcome, neverAskAgain?: boolean) => void;
}

export default function SadaqahPrompt({
  visible, trigger, onOutcome }: SadaqahPromptProps) {
  const hasLoggedRef = React.useRef(false);
  // Once the user picks a sentiment, swap the CTA for the up/down-specific copy
  // rather than closing immediately — gives a brief, clear confirmation of what
  // happens next (native review vs. feedback screen).
  const [sentiment, setSentiment] = React.useState<'up' | 'down' | null>(null);

  React.useEffect(() => {
    if (visible && !hasLoggedRef.current) {
      hasLoggedRef.current = true;
      logScreenView('modal_sadaqahprompt').catch(() => {});
    }
    if (!visible) {
      hasLoggedRef.current = false;
      setSentiment(null);
    }
  }, [visible]);

  const getCopy = () => {
    switch (trigger) {
      case 'first_quiz':
        return { headline: "Masha'Allah!", body: "You've just completed your first quiz. How's your iHafidh experience been so far?" };
      case 'fifth_quiz':
        return { headline: "5 quizzes — Masha'Allah!", body: "Great progress! How's your iHafidh experience been so far?" };
      case 'tenth_quiz':
        return { headline: "10 quizzes — SubhanAllah!", body: "Your dedication is inspiring. How's your iHafidh experience been so far?" };
      case 'twentieth_quiz':
        return { headline: "20 quizzes — Alhamdulillah!", body: "Consistency is key to Hifdh! How's your iHafidh experience been so far?" };
      case 'juz_completed':
        return { headline: "Juz complete — Alhamdulillah!", body: "You've completed a full Juz. How's your iHafidh experience been so far?" };
      case 'badge_unlocked':
        return { headline: "Masha'Allah, a new badge!", body: "You're making real progress. How's your iHafidh experience been so far?" };
      case 'surah_completed':
        return { headline: "Surah complete — Alhamdulillah!", body: "Another surah in the bag. How's your iHafidh experience been so far?" };
      case 'streak_milestone':
        return { headline: "Streak milestone — Masha'Allah!", body: "You're building a real habit. How's your iHafidh experience been so far?" };
      default:
        return { headline: "Masha'Allah!", body: "How's your iHafidh experience been so far?" };
    }
  };

  const copy = getCopy();

  React.useEffect(() => {
    if (visible) {
      logAnalyticsEvent('review_prompt_shown', { trigger });
    }
  }, [visible, trigger]);

  const handleThumbsUp = () => {
    setSentiment('up');
    logAnalyticsEvent('review_prompt_sentiment', { trigger, sentiment: 'up' });
  };

  const handleThumbsDown = () => {
    setSentiment('down');
    logAnalyticsEvent('review_prompt_sentiment', { trigger, sentiment: 'down' });
  };

  const handleContinue = () => {
    if (sentiment === 'up') {
      logAnalyticsEvent('review_prompt_tapped', { trigger });
      onOutcome('up');
    } else if (sentiment === 'down') {
      onOutcome('down');
    }
  };

  const handleDismiss = (neverAskAgain?: boolean) => {
    logAnalyticsEvent('review_prompt_dismissed', { trigger, never_ask_again: !!neverAskAgain });
    onOutcome('dismissed', neverAskAgain);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <LinearGradient
          colors={['#1a1a1a', '#0a0a0a']}
          style={styles.container}
        >
          <Text style={styles.headline}>{copy.headline}</Text>
          <Text style={styles.body}>{copy.body}</Text>

          {sentiment === null ? (
            <View style={styles.thumbsRow}>
              <Pressable style={styles.thumbButton} onPress={handleThumbsUp} accessibilityRole="button" accessibilityLabel="Thumbs up">
                <Text style={styles.thumbEmoji}>👍</Text>
                <Text style={styles.thumbLabel}>{"It's great"}</Text>
              </Pressable>
              <Pressable style={styles.thumbButton} onPress={handleThumbsDown} accessibilityRole="button" accessibilityLabel="Thumbs down">
                <Text style={styles.thumbEmoji}>👎</Text>
                <Text style={styles.thumbLabel}>Needs work</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.followUpText}>
                {sentiment === 'up'
                  ? "That's Sadaqah Jariyah waiting to happen — a quick review helps other Muslims find iHafidh."
                  : "We'd love to know what would make it better — takes 10 seconds, no pressure."}
              </Text>
              <Pressable style={styles.ctaButton} onPress={handleContinue} accessibilityRole="button">
                <Text style={styles.ctaText}>
                  {sentiment === 'up' ? 'Leave a review — earn Sadaqah Jariyah' : 'Tell us what to fix'}
                </Text>
              </Pressable>
              {sentiment === 'down' && (
                <Pressable
                  style={styles.alternateStoreAction}
                  onPress={() => {
                    logAnalyticsEvent('review_prompt_tapped', { trigger, alternate_store_rate: true });
                    onOutcome('up');
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.alternateStoreText}>
                    Or rate on the App Store anyway
                  </Text>
                </Pressable>
              )}
            </>
          )}

          <View style={styles.footerRow}>
            <Pressable onPress={() => handleDismiss(false)} hitSlop={10} style={styles.footerAction}>
              <Text style={styles.dismissText}>Maybe later</Text>
            </Pressable>
            <Text style={styles.footerSeparator}>•</Text>
            <Pressable onPress={() => handleDismiss(true)} hitSlop={10} style={styles.footerAction}>
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
    marginBottom: 24,
  },
  thumbsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginBottom: 8,
  },
  thumbButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  thumbEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  thumbLabel: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  followUpText: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
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
  alternateStoreAction: {
    paddingVertical: 6,
    marginBottom: 12,
    alignItems: 'center',
  },
  alternateStoreText: {
    color: '#94A3B8',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
