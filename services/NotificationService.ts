import notifee, {
    AndroidImportance,
    AndroidVisibility,
    EventType,
    RepeatFrequency,
    TimestampTrigger,
    TriggerType
} from '@notifee/react-native';
import { Platform } from 'react-native';

// ============================================================================
// INITIALIZATION (Call ONCE at app startup)
// ============================================================================

let isInitialized = false;

export async function initializeNotifications(): Promise<void> {
  if (isInitialized) {
    console.log('[NotificationService] Already initialized');
    return;
  }

  try {
    // Create Android Channels
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: 'default',
        name: 'Default Notifications',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        lightColor: '#FFD700',
        vibration: true,
      });

      await notifee.createChannel({
        id: 'fasting',
        name: 'Fasting Reminders',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        lightColor: '#FFD700',
        vibration: true,
      });

      await notifee.createChannel({
        id: 'ayah',
        name: 'Daily Ayah',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        lightColor: '#FFD700',
        vibration: true,
      });

      await notifee.createChannel({
        id: 'revision',
        name: 'Revision Reminders',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        lightColor: '#FFD700',
        vibration: true,
      });

      await notifee.createChannel({
        id: 'planner',
        name: 'Hifdh Planner',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        lightColor: '#FFD700',
        vibration: true,
      });

      console.log('[NotificationService] Android channels created');
    }

    // Request permissions on init (optional, usually better to request on demand)
    // But for migration parity, we can leave it to the explicit request function.

    // Setup foreground listener for immediate actions (like weekly check trigger)
    notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === EventType.DELIVERED) {
        const data = detail.notification?.data;

        // Handle weekly Friday check
        if (data?.type === 'weekly-surah-check') {
          const today = new Date().getDay();
          if (today === 5) { // Only on Friday
            await notifee.displayNotification({
              title: '📅 Weekly Surah Check-in',
              body: 'Time to review your weekly Surah progress. Stay consistent! 🌟',
              data: { type: 'weekly-surah-reminder' },
              android: { channelId: 'revision' },
            });
          }
        }

        // Handle daily revision check
        if (data?.type === 'revision-check-trigger') {
          await RevisionReminderService.checkAndNotifyRevisionNeeded(3);
        }
      }
    });

    isInitialized = true;
    console.log('[NotificationService] Initialization complete');
  } catch (error) {
    console.error('[NotificationService] Initialization failed:', error);
    throw error;
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const settings = await notifee.requestPermission();

    if (settings.authorizationStatus >= 1) { // 1 = AUTHORIZED, 2 = PROVISIONAL
      console.log('[NotificationService] Permission granted');
      return true;
    }

    console.log('[NotificationService] Permission denied');
    return false;
  } catch (error) {
    console.error('[NotificationService] Permission request failed:', error);
    return false;
  }
}

// ============================================================================
// CORE NOTIFICATION FUNCTIONS
// ============================================================================

function isDateInFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}

export async function scheduleNotificationAtDate({
  id,
  title,
  body,
  date,
  channelId = 'default',
  data = {
    highlightAyah: `${id}`
  },
}: {
  id: string;
  title: string;
  body: string;
  date: Date;
  channelId?: string;
  data?: Record<string, any>;
}): Promise<string | null> {
  try {
    if (!isDateInFuture(date)) {
      console.warn('[NotificationService] Cannot schedule in past:', id);
      return null;
    }

    // Create a time-based trigger
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: date.getTime(),
    };

    await notifee.createTriggerNotification(
      {
        id,
        title,
        body,
        data,
        android: {
          channelId,
          pressAction: {
            id: 'default',
          },
        },
        ios: {
          sound: 'default',
        },
      },
      trigger,
    );

    console.log('[NotificationService] Scheduled:', id, 'at', date.toISOString());
    return id;
  } catch (error) {
    console.error('[NotificationService] Schedule failed:', error);
    return null;
  }
}

export async function scheduleDailyNotification({
  id,
  title,
  body,
  hour,
  minute,
  channelId = 'default',
  data = {
    highlightAyah: `${id}`
  },
  silent = false,
}: {
  id: string;
  title: string;
  body: string;
  hour: number;
  minute: number;
  channelId?: string;
  data?: Record<string, any>;
  silent?: boolean;
}): Promise<string | null> {
  try {
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      console.warn('[NotificationService] Invalid time:', { hour, minute });
      return null;
    }

    // Calculate next occurrence
    const now = new Date();
    const date = new Date(now);
    date.setHours(hour, minute, 0, 0);

    if (date.getTime() <= now.getTime()) {
      date.setDate(date.getDate() + 1);
    }

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: date.getTime(),
      repeatFrequency: RepeatFrequency.DAILY,
    };

    await notifee.createTriggerNotification(
      {
        id,
        title: silent ? undefined : title, // Silent notifications often have no title/body visible
        body: silent ? undefined : body,
        data,
        android: {
          channelId,
          pressAction: {
            id: 'default',
          },
          // For silent background triggers
          ...(silent && {
            importance: AndroidImportance.MIN,
            visibility: AndroidVisibility.SECRET,
          }),
        },
        ios: {
          sound: silent ? undefined : 'default',
        },
      },
      trigger,
    );

    console.log('[NotificationService] Scheduled daily:', id, `at ${hour}:${minute}`);
    return id;
  } catch (error) {
    console.error('[NotificationService] Daily schedule failed:', error);
    return null;
  }
}

export async function cancelNotification(id: string): Promise<void> {
  try {
    await notifee.cancelNotification(id);
    await notifee.cancelTriggerNotification(id); // Ensure trigger is also cancelled
  } catch (error) {
    // Silent fail
  }
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    await notifee.cancelAllNotifications();
    console.log('[NotificationService] All notifications cancelled');
  } catch (error) {
    console.error('[NotificationService] Cancel all failed:', error);
  }
}

export async function getScheduledNotifications(): Promise<string[]> {
  try {
    const ids = await notifee.getTriggerNotificationIds();
    return ids;
  } catch (error) {
    console.error('[NotificationService] Get scheduled failed:', error);
    return [];
  }
}

export async function sendTestNotification(): Promise<void> {
  try {
    await notifee.displayNotification({
      title: '🧪 Test Notification',
      body: 'If you see this, notifications are working!',
      data: { type: 'test' },
      android: {
        channelId: 'default',
        pressAction: {
          id: 'default',
        },
      },
    });
    console.log('[NotificationService] Test notification sent');
  } catch (error) {
    console.error('[NotificationService] Test failed:', error);
  }
}

// ============================================================================
// FASTING NOTIFICATION SERVICE
// ============================================================================

export class FastingNotificationService {
  static async scheduleReminder({
    fastingType,
    fastingName,
    fastingDescription,
    date,
    beforeDays = 1,
    time = '09:00',
  }: {
    fastingType: string;
    fastingName: string;
    fastingDescription: string;
    date: string;
    beforeDays?: number;
    time?: string;
  }): Promise<void> {
    try {
      const [hourStr, minuteStr] = time.split(':');
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);

      if (isNaN(hour) || isNaN(minute)) {
        console.warn('[FastingNotificationService] Invalid time:', time);
        return;
      }

      const fastingDate = new Date(date);
      if (isNaN(fastingDate.getTime())) {
        console.warn('[FastingNotificationService] Invalid date:', date);
        return;
      }

      const reminderDate = new Date(fastingDate);
      reminderDate.setDate(reminderDate.getDate() - beforeDays);
      reminderDate.setHours(hour, minute, 0, 0);

      const id = `fasting_${fastingType}_${date}`;

      await scheduleNotificationAtDate({
        id,
        title: `🌙 ${fastingName} Reminder`,
        body: `${fastingDescription} is ${beforeDays === 0 ? 'today' : `in ${beforeDays} day${beforeDays > 1 ? 's' : ''}`}`,
        date: reminderDate,
        channelId: 'fasting',
        data: {
          type: 'fasting',
          fastingType,
          fastingDate: date,
        },
      });
    } catch (error) {
      console.error('[FastingNotificationService] Schedule failed:', error);
    }
  }

  static async cancelAllFastingReminders(): Promise<void> {
    try {
      const ids = await getScheduledNotifications();
      const fastingIds = ids.filter(id => id.startsWith('fasting_'));

      for (const id of fastingIds) {
        await cancelNotification(id);
      }

      console.log('[FastingNotificationService] Cancelled all fasting reminders');
    } catch (error) {
      console.error('[FastingNotificationService] Cancel failed:', error);
    }
  }

  // Initialize placeholder for compatibility with _layout.tsx
  static async initialize(): Promise<void> {
    // No-op for Notifee as channels are created in main init
  }
}

// ============================================================================
// AYAH NOTIFICATION SERVICE
// ============================================================================

export class AyahNotificationService {
  private static readonly DAILY_AYAH_ID = 'daily_ayah';

  static async scheduleDailyReminder(time: string): Promise<void> {
    try {
      const [hourStr, minuteStr] = time.split(':');
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);

      if (isNaN(hour) || isNaN(minute)) {
        console.warn('[AyahNotificationService] Invalid time:', time);
        return;
      }

      // Schedule a one-time notification for the next occurrence so content is fresh.
      // The app will reschedule when it becomes active to update the following day's content.
      try {
        const { getTodayCardVerse } = await import('@/utils/ayahOfTheDay');
        const { fetchSingleVerse } = await import('@/services/quranApi');
        const { surahsData } = await import('@/data/surahs');
        const todayVerse = getTodayCardVerse(new Date());
        const verse = await fetchSingleVerse(todayVerse.surahId, todayVerse.verseNumber);
        const surah = surahsData.find(s => s.id === todayVerse.surahId);

        const title = surah ? `📖 ${surah.name} • ${todayVerse.verseNumber}` : '📖 Daily Ayah';
        // Prefer the translated text (strip html) but fallback to a short arabic excerpt
        let bodyText = '';
        if (verse?.translation) bodyText = (verse.translation || '').replace(/<[^>]+>/g, '').slice(0, 120);
        else if (verse?.arabicText) bodyText = (verse.arabicText || '').slice(0, 80);

        // Cancel any previous notification to avoid duplication
        await cancelNotification(this.DAILY_AYAH_ID);

        // Compute next occurrence for the provided hour/minute
        const now = new Date();
        const nextDate = new Date(now);
        nextDate.setHours(hour, minute, 0, 0);
        if (nextDate <= now) nextDate.setDate(nextDate.getDate() + 1);

        await scheduleNotificationAtDate({
          id: this.DAILY_AYAH_ID,
          title,
          body: bodyText || 'Your daily verse is ready. Tap to read and reflect.',
          date: nextDate,
          channelId: 'ayah',
          data: {
            type: 'daily_ayah',
            target: 'index',
            highlightAyah: `${todayVerse.surahId}-${todayVerse.verseNumber}`,
            surahId: todayVerse.surahId,
            verseNumber: todayVerse.verseNumber,
          },
        });

      } catch (innerErr) {
        // Fallback — schedule a simple daily ayah reminder if fetching fails
        await cancelNotification(this.DAILY_AYAH_ID);

        const now2 = new Date();
        const next = new Date(now2);
        next.setHours(hour, minute, 0, 0);
        if (next <= now2) next.setDate(next.getDate() + 1);

        await scheduleNotificationAtDate({
          id: this.DAILY_AYAH_ID,
          title: '📖 Daily Ayah',
          body: 'Your daily verse is ready. Tap to read and reflect.',
          date: next,
          channelId: 'ayah',
          data: {
            type: 'daily_ayah',
            target: 'index',
            highlightAyah: 'daily-ayah',
          },
        });
      }
    } catch (error) {
      console.error('[AyahNotificationService] Schedule failed:', error);
    }
  }

  static async cancelDailyReminder(): Promise<void> {
    await cancelNotification(this.DAILY_AYAH_ID);
  }
}

// ============================================================================
// REVISION NOTIFICATION SERVICE
// ============================================================================

export class RevisionNotificationService {
  private static readonly DAILY_REVISION_ID = 'daily-revision-reminder';
  private static readonly WEEKLY_REVISION_ID = 'weekly-revision-reminder';

  static async scheduleDailyReminder(incomplete: boolean): Promise<void> {
    try {
      if (!incomplete) {
        await cancelNotification(this.DAILY_REVISION_ID);
        return;
      }

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 0, 0);

      if (!isDateInFuture(endOfDay)) {
        return;
      }

      await scheduleNotificationAtDate({
        id: this.DAILY_REVISION_ID,
        title: '📚 Daily Revision Reminder',
        body: "You haven't completed your daily Quran revision goal. Stay on track!",
        date: endOfDay,
        channelId: 'revision',
        data: {
          type: 'daily_revision',
        },
      });
    } catch (error) {
      console.error('[RevisionNotificationService] Daily schedule failed:', error);
    }
  }

  static async scheduleWeeklyReminder(incomplete: boolean): Promise<void> {
    try {
      if (!incomplete) {
        await cancelNotification(this.WEEKLY_REVISION_ID);
        return;
      }

      const now = new Date();
      const endOfWeek = new Date(now);
      const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
      endOfWeek.setDate(now.getDate() + daysUntilSunday);
      endOfWeek.setHours(23, 59, 0, 0);

      if (!isDateInFuture(endOfWeek)) {
        return;
      }

      await scheduleNotificationAtDate({
        id: this.WEEKLY_REVISION_ID,
        title: '📅 Weekly Revision Reminder',
        body: 'Weekly revision goal not achieved. Review your progress!',
        date: endOfWeek,
        channelId: 'revision',
        data: {
          type: 'weekly_revision',
        },
      });
    } catch (error) {
      console.error('[RevisionNotificationService] Weekly schedule failed:', error);
    }
  }

  static async cancelAllReminders(): Promise<void> {
    await cancelNotification(this.DAILY_REVISION_ID);
    await cancelNotification(this.WEEKLY_REVISION_ID);
  }

  /**
   * Schedule intelligent page revision reminder
   */
  static async schedulePageReminder(
    dailyIncomplete: boolean,
    weeklyIncomplete: boolean,
    dailyProgress: number,
    dailyTarget: number,
    weeklyProgress: number,
    weeklyTarget: number
  ): Promise<void> {
    try {
      const PAGE_REMINDER_ID = 'page-revision-reminder';

      // If both goals are complete, cancel any existing notification
      if (!dailyIncomplete && !weeklyIncomplete) {
        await cancelNotification(PAGE_REMINDER_ID);
        return;
      }

      // Determine when to send the notification
      const now = new Date();
      let notificationDate: Date;
      let title: string;
      let body: string;

      if (dailyIncomplete && weeklyIncomplete) {
        // Both incomplete - send at end of day
        notificationDate = new Date();
        notificationDate.setHours(23, 59, 0, 0);

        title = '📄 Page Revision Goals';
        body = `Daily: ${dailyProgress}/${dailyTarget} pages • Weekly: ${weeklyProgress}/${weeklyTarget} pages. Keep going!`;
      } else if (dailyIncomplete) {
        // Only daily incomplete - send at end of day
        notificationDate = new Date();
        notificationDate.setHours(23, 59, 0, 0);

        title = '📄 Daily Page Goal';
        body = `You've revised ${dailyProgress}/${dailyTarget} pages today. Almost there!`;
      } else {
        // Only weekly incomplete - send at end of week (Sunday)
        notificationDate = new Date(now);
        const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
        notificationDate.setDate(now.getDate() + daysUntilSunday);
        notificationDate.setHours(23, 59, 0, 0);

        title = '📄 Weekly Page Goal';
        body = `Weekly progress: ${weeklyProgress}/${weeklyTarget} pages. Review your progress!`;
      }

      if (!isDateInFuture(notificationDate)) {
        return;
      }

      await scheduleNotificationAtDate({
        id: PAGE_REMINDER_ID,
        title,
        body,
        date: notificationDate,
        channelId: 'revision',
        data: {
          type: 'page_revision',
          dailyIncomplete,
          weeklyIncomplete,
        },
      });
    } catch (error) {
      console.error('[RevisionNotificationService] Page reminder failed:', error);
    }
  }
}

// ============================================================================
// ENHANCED NOTIFICATION SERVICE
// ============================================================================

export class EnhancedNotificationService {
  static async scheduleDailyVerseReminder(): Promise<void> {
    try {
      await scheduleDailyNotification({
        id: 'daily-verse-reminder',
        title: '🎯 Daily Goal Reminder',
        body: "You haven't completed your daily verse target. Keep going! 💪",
        hour: 20,
        minute: 0,
        channelId: 'revision',
        data: {
          type: 'daily-verse-reminder',
        },
      });
    } catch (error) {
      console.error('[EnhancedNotificationService] Daily verse failed:', error);
    }
  }

  static async scheduleWeeklySurahReminder(): Promise<void> {
    try {
      // With Notifee, we can schedule a true weekly notification!
      // But for now, to keep logic similar to before (Friday check), 
      // we can use a weekly trigger if we know the date.
      // Or we can stick to the "Daily Silent Check" pattern which is robust.
      // Let's stick to Daily Silent Check for simplicity of migration.

      await scheduleDailyNotification({
        id: 'weekly-surah-check',
        title: 'Weekly Check', // Title needed for Notifee even if silent?
        body: 'Checking...',
        hour: 18,
        minute: 0,
        channelId: 'revision',
        data: {
          type: 'weekly-surah-check', // Trigger for the listener
        },
        silent: true,
      });

      console.log('[EnhancedNotificationService] Weekly Friday check scheduled');
    } catch (error) {
      console.error('[EnhancedNotificationService] Weekly surah failed:', error);
    }
  }

  static async scheduleHifdhPlannerReminder(overdueItems: Array<{ title: string; dueDate: string }>): Promise<void> {
    try {
      if (overdueItems.length === 0) return;

      await notifee.displayNotification({
        title: '⏰ Hifdh Reminder',
        body: `You have ${overdueItems.length} overdue memorization ${overdueItems.length === 1 ? 'task' : 'tasks'}. 📋`,
        data: {
          type: 'hifdh-overdue',
          overdueCount: overdueItems.length,
        },
        android: { channelId: 'planner' },
      });
    } catch (error) {
      console.error('[EnhancedNotificationService] Planner reminder failed:', error);
    }
  }

  static setupNotificationHandlers(navigation: any): (() => void) | undefined {
    // Notifee handles this via onForegroundEvent and getInitialNotification in _layout.tsx
    // This method is kept for backward compatibility if called, but does nothing or logs warning.
    console.log('[EnhancedNotificationService] setupNotificationHandlers is deprecated. Handled in _layout.tsx');
    return () => { };
  }

  static async cancelDailyVerseReminder(): Promise<void> {
    await cancelNotification('daily-verse-reminder');
  }

  static async cancelWeeklySurahReminder(): Promise<void> {
    await cancelNotification('weekly-surah-check');
  }

  static async cancelAllEnhancedNotifications(): Promise<void> {
    await this.cancelDailyVerseReminder();
    await this.cancelWeeklySurahReminder();
  }
}

// ============================================================================
// REVISION REMINDER SERVICE
// ============================================================================

export class RevisionReminderService {
  private static REVISION_CHECK_TRIGGER_ID = 'revision-check-trigger';

  /**
   * Schedule daily silent notification at 9 PM that triggers revision check
   */
  /**
   * Schedule generic daily revision reminders for the next 30 days.
   * This ensures reliability even if the app isn't opened for weeks.
   */
  static async scheduleDailyRevisionCheck(): Promise<void> {
    try {
      console.log('[RevisionReminder] Scheduling 30 days of generic revision reminders at 9 PM');

      // Cancel existing to prevent duplicates
      await this.cancelRevisionReminders();

      const baseDate = new Date();
      baseDate.setHours(21, 0, 0, 0); // 9 PM

      // If 9 PM has passed today, start from tomorrow
      if (baseDate <= new Date()) {
        baseDate.setDate(baseDate.getDate() + 1);
      }

      // Schedule for next 30 days
      for (let i = 0; i < 30; i++) {
        const date = new Date(baseDate);
        date.setDate(baseDate.getDate() + i);

        const id = `daily-revision-habit-${i}`;

        await scheduleNotificationAtDate({
          id,
          title: '📖 Time to Revise',
          body: 'Consistency is key! Take 10 minutes to review your Hifdh.',
          date: date,
          channelId: 'revision',
          data: {
            type: 'daily_revision_habit',
          },
        });
      }

      console.log('[RevisionReminder] Batch scheduling complete');
    } catch (error) {
      console.error('[RevisionReminder] Scheduling failed:', error);
    }
  }

  /**
   * Check for surahs needing revision and send notification if found.
   * This is called on app foreground to provide specific "smart" alerts.
   */
  static async checkAndNotifyRevisionNeeded(daysThreshold: number = 3): Promise<void> {
    try {
      console.log(`[RevisionReminder] Checking surahs (${daysThreshold} days threshold)`);

      const { getSurahsNeedingRevision } = await import('@/assets/database/QuranDatabase');
      const surahsNeedingRevision = await getSurahsNeedingRevision(daysThreshold);

      if (surahsNeedingRevision.length === 0) {
        console.log('[RevisionReminder] No surahs need revision');
        return;
      }

      const oldestSurah = surahsNeedingRevision[0];
      const count = surahsNeedingRevision.length;

      const title = count === 1
        ? '🔄 Time to Revise!'
        : `🔄 ${count} Surahs Need Revision`;

      const body = count === 1
        ? `${oldestSurah.surahName} hasn't been revised in ${oldestSurah.daysSince} days. 💪`
        : `${count} surahs need revision. ${oldestSurah.surahName} hasn't been reviewed in ${oldestSurah.daysSince} days! 💪`;

      // Send ACTUAL notification with results (Immediate display)
      await notifee.displayNotification({
        title,
        body,
        data: {
          type: 'revision-needed',
          count,
          oldestDays: oldestSurah.daysSince,
          surahId: oldestSurah.surahId,
        },
        android: { channelId: 'revision' },
      });

      console.log('[RevisionReminder] Sent notification for', count, 'surahs');
    } catch (error) {
      console.error('[RevisionReminder] Check failed:', error);
    }
  }

  static async cancelRevisionReminders(): Promise<void> {
    // Cancel the old trigger ID if it exists
    await cancelNotification(this.REVISION_CHECK_TRIGGER_ID);

    // Cancel the new batch IDs
    for (let i = 0; i < 30; i++) {
      await cancelNotification(`daily-revision-habit-${i}`);
    }
  }
}