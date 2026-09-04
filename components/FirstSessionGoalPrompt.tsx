/**
 * First-session goal/streak prompt (Sept release spec, item 3).
 *
 * Symptom: `streak_achieved` fires regularly so a streak mechanic exists, but
 * "Inactive New Users" (one-session-then-gone) is still ~46% of the user base.
 * The streak/goal hook wasn't shown early enough or prominently enough.
 *
 * Fix: this is the first thing a brand-new user is asked to do immediately
 * after their first recite session ends — set a simple daily verse goal, with
 * an optional reminder. It is queued from app/(tabs)/read.tsx and shown here
 * from app/_layout.tsx once the user is safely back on the Home screen.
 *
 * This is also the hook point for item 1 (delay the iOS notification
 * permission prompt): permission is requested only after this prompt closes
 * (confirmed or skipped) — i.e. after the user has a genuine reason to say
 * yes, never on cold open.
 */

import { logAnalyticsEvent, logScreenView } from '@/utils/analyticsHelper';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export interface FirstSessionGoalPromptProps {
  visible: boolean;
  /**
   * goalVerses: the daily verse goal the user picked, or null if they skipped.
   * wantsReminder: whether they asked for a daily reminder notification tied
   * to that goal (the one exception to the item-4 7-day notification suppression).
   */
  onClose: (goalVerses: number | null, wantsReminder: boolean) => void;
}

const GOAL_OPTIONS = [3, 5, 10];

export default function FirstSessionGoalPrompt({ visible, onClose }: FirstSessionGoalPromptProps) {
  const [selectedGoal, setSelectedGoal] = React.useState<number>(5);
  const [wantsReminder, setWantsReminder] = React.useState(true);
  const hasLoggedRef = React.useRef(false);

  React.useEffect(() => {
    if (visible && !hasLoggedRef.current) {
      hasLoggedRef.current = true;
      logScreenView('modal_first_session_goal_prompt').catch(() => {});
      logAnalyticsEvent('first_session_goal_prompt_shown', {});
    }
    if (!visible) hasLoggedRef.current = false;
  }, [visible]);

  const handleSetGoal = () => {
    logAnalyticsEvent('first_session_goal_set', {
      goal_verses: selectedGoal,
      wants_reminder: wantsReminder,
    });
    onClose(selectedGoal, wantsReminder);
  };

  const handleSkip = () => {
    logAnalyticsEvent('first_session_goal_skipped', {});
    onClose(null, false);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <LinearGradient colors={['#1a1a1a', '#0a0a0a']} style={styles.container}>
          <Text style={styles.headline}>Masha'Allah on your first session! 🌙</Text>
          <Text style={styles.body}>
            Set a daily goal to build a consistent Hifdh habit. How many verses would you like to memorise or revise each day?
          </Text>

          <View style={styles.goalRow}>
            {GOAL_OPTIONS.map((g) => {
              const active = selectedGoal === g;
              return (
                <Pressable
                  key={g}
                  onPress={() => setSelectedGoal(g)}
                  accessibilityRole="button"
                  style={[styles.goalChip, active && styles.goalChipActive]}
                >
                  <Text style={[styles.goalChipText, active && styles.goalChipTextActive]}>{g} / day</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => setWantsReminder(!wantsReminder)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: wantsReminder }}
            style={styles.reminderRow}
          >
            <View style={[styles.checkbox, wantsReminder && styles.checkboxChecked]}>
              {wantsReminder && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.reminderText}>Remind me daily to keep my streak going</Text>
          </Pressable>

          <Pressable style={styles.ctaButton} onPress={handleSetGoal} accessibilityRole="button">
            <Text style={styles.ctaText}>Set my goal</Text>
          </Pressable>

          <Pressable onPress={handleSkip} hitSlop={10} style={styles.skipAction} accessibilityRole="button">
            <Text style={styles.skipText}>Maybe later</Text>
          </Pressable>
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
    paddingBottom: 32,
  },
  container: {
    width: '100%',
    maxWidth: 600,
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: '#D4AF3740',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  headline: {
    color: '#D4AF37',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    color: '#E2E8F0',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  goalRow: {
    flexDirection: 'row',
    marginBottom: 18,
    gap: 10,
  },
  goalChip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#475569',
  },
  goalChipActive: {
    backgroundColor: '#D4AF37',
    borderColor: '#D4AF37',
  },
  goalChipText: {
    color: '#E2E8F0',
    fontWeight: '600',
    fontSize: 14,
  },
  goalChipTextActive: {
    color: '#1a1a1a',
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#D4AF37',
    borderColor: '#D4AF37',
  },
  checkmark: {
    color: '#1a1a1a',
    fontSize: 13,
    fontWeight: '800',
  },
  reminderText: {
    color: '#CBD5E1',
    fontSize: 13,
    flexShrink: 1,
  },
  ctaButton: {
    backgroundColor: '#D4AF37',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
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
  skipAction: {
    paddingVertical: 4,
  },
  skipText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
});
