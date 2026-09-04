/**
 * First-7-days notification suppression (Sept release spec, item 4).
 *
 * Symptom: notification dismiss rate climbed to 73–75%. New users getting hit
 * with notifications before they've formed any opinion of the app is a
 * plausible uninstall driver. Fix: suppress all non-essential notifications
 * for the first 7 days after install, except the one reminder the user
 * explicitly opted into via the first-session goal/streak prompt (item 3).
 */

import { useSettingsStore } from '@/store/settingsStore';

export const SUPPRESSION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type SuppressibleNotificationType =
  | 'daily_verse_reminder'
  | 'weekly_surah_reminder'
  | 'revision_reminder'
  | 'daily_ayah'
  | 'fasting';

/** True for the first 7 days after install (or if install time is unknown — see note). */
export function isWithinFirstWeek(): boolean {
  const installedAt = useSettingsStore.getState().installedAt;
  // Unknown install time should never happen post-migration (settingsStore backfills
  // it for every user on rehydrate), but fail open rather than suppressing forever.
  if (!installedAt) return false;
  return Date.now() - installedAt < SUPPRESSION_WINDOW_MS;
}

/**
 * Whether a given notification type is allowed to fire/subscribe right now.
 * During the first 7 days, only the specific reminder the user explicitly
 * opted into from the first-session prompt is allowed through — everything
 * else (daily ayah, weekly surah reminder, revision reminder, fasting) waits
 * until day 7.
 */
export function isNotificationTypeAllowedDuringSuppression(type: SuppressibleNotificationType): boolean {
  if (!isWithinFirstWeek()) return true;
  const optedInType = useSettingsStore.getState().firstSessionOptedInReminderType;
  return optedInType === type;
}
