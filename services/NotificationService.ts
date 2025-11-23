import * as Notifications from 'expo-notifications';
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
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        // Newer expo-notifications expects explicit banner/list flags
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    if (Platform.OS === 'android') {
      await Promise.all([
        Notifications.setNotificationChannelAsync('default', {
          name: 'Default Notifications',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FFD700',
        }),
        Notifications.setNotificationChannelAsync('fasting', {
          name: 'Fasting Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FFD700',
        }),
        Notifications.setNotificationChannelAsync('ayah', {
          name: 'Daily Ayah',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FFD700',
        }),
        Notifications.setNotificationChannelAsync('revision', {
          name: 'Revision Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FFD700',
        }),
        Notifications.setNotificationChannelAsync('planner', {
          name: 'Hifdh Planner',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FFD700',
        }),
      ]);
      console.log('[NotificationService] Android channels created');
    }

    // Setup notification received listener for foreground handling
    Notifications.addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data as any;
      
      // Handle weekly Friday check
      if (data.type === 'weekly-surah-check') {
        const today = new Date().getDay();
        if (today === 5) { // Only on Friday
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '📅 Weekly Surah Check-in',
              body: 'Time to review your weekly Surah progress. Stay consistent! 🌟',
              data: { type: 'weekly-surah-reminder' },
              sound: true,
            },
            trigger: Platform.OS === 'android' ? { channelId: 'revision' } : null,
          });
        }
      }
      
      // Handle daily revision check
      if (data.type === 'revision-check-trigger') {
        await RevisionReminderService.checkAndNotifyRevisionNeeded(3);
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
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[NotificationService] Permission denied');
      return false;
    }

    console.log('[NotificationService] Permission granted');
    return true;
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
  data = {},
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

    await cancelNotification(id);

    const notificationId = await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        ...(Platform.OS === 'android' && { channelId }),
      },
    });

    console.log('[NotificationService] Scheduled:', id, 'at', date.toISOString());
    return notificationId;
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
  data = {},
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

    await cancelNotification(id);

    const notificationId = await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title,
        body,
        data,
        sound: !silent,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute,
        repeats: true,
        ...(Platform.OS === 'android' && { channelId }),
      },
    });

    console.log('[NotificationService] Scheduled daily:', id, `at ${hour}:${minute}`);
    return notificationId;
  } catch (error) {
    console.error('[NotificationService] Daily schedule failed:', error);
    return null;
  }
}

export async function cancelNotification(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (error) {
    // Silent fail
  }
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[NotificationService] All notifications cancelled');
  } catch (error) {
    console.error('[NotificationService] Cancel all failed:', error);
  }
}

export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('[NotificationService] Get scheduled failed:', error);
    return [];
  }
}

export async function sendTestNotification(): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🧪 Test Notification',
        body: 'If you see this, notifications are working!',
        data: { type: 'test' },
        sound: true,
      },
      trigger: null,
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
      const scheduled = await getScheduledNotifications();
      const fastingNotifications = scheduled.filter(n => n.identifier.startsWith('fasting_'));

      for (const notification of fastingNotifications) {
        await cancelNotification(notification.identifier);
      }

      console.log('[FastingNotificationService] Cancelled all fasting reminders');
    } catch (error) {
      console.error('[FastingNotificationService] Cancel failed:', error);
    }
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

      await scheduleDailyNotification({
        id: this.DAILY_AYAH_ID,
        title: '📖 Daily Ayah',
        body: 'Your daily verse is ready. Tap to read and reflect.',
        hour,
        minute,
        channelId: 'ayah',
        data: {
          type: 'daily_ayah',
        },
      });
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
      // Schedule DAILY silent notification at 6 PM
      // The notification received listener checks if it's Friday
      await scheduleDailyNotification({
        id: 'weekly-surah-check',
        title: '', // Silent
        body: '',
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

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Hifdh Reminder',
          body: `You have ${overdueItems.length} overdue memorization ${overdueItems.length === 1 ? 'task' : 'tasks'}. 📋`,
          data: {
            type: 'hifdh-overdue',
            overdueCount: overdueItems.length,
          },
          sound: true,
        },
        trigger: Platform.OS === 'android' ? { channelId: 'planner' } : null,
      });
    } catch (error) {
      console.error('[EnhancedNotificationService] Planner reminder failed:', error);
    }
  }

  static setupNotificationHandlers(navigation: any): (() => void) | undefined {
    try {
      const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as any;

        switch (data.type) {
          case 'daily_ayah':
          case 'daily-ayah':
            navigation?.navigate('(tabs)', { screen: 'index' });
            break;
          case 'daily-verse-reminder':
            navigation?.navigate('(tabs)', { screen: 'read' });
            break;
          case 'weekly-surah-reminder':
            navigation?.navigate('(tabs)', { screen: 'stats' });
            break;
          case 'hifdh-overdue':
          case 'revision-needed':
            navigation?.navigate('(tabs)', { screen: 'index' });
            break;
        }
      });

      console.log('[EnhancedNotificationService] Navigation handlers setup');
      return () => subscription.remove();
    } catch (error) {
      console.error('[EnhancedNotificationService] Handler setup failed:', error);
    }
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
   * The actual check happens in the notification received listener
   */
  static async scheduleDailyRevisionCheck(): Promise<void> {
    try {
      console.log('[RevisionReminder] Scheduling daily revision check trigger at 9 PM');
      
      await cancelNotification(this.REVISION_CHECK_TRIGGER_ID);
      
      // Schedule SILENT daily notification that triggers the check
      await scheduleDailyNotification({
        id: this.REVISION_CHECK_TRIGGER_ID,
        title: '', // Silent
        body: '',
        hour: 21,
        minute: 0,
        channelId: 'revision',
        data: { 
          type: 'revision-check-trigger',
        },
        silent: true,
      });
      
      console.log('[RevisionReminder] Daily check trigger scheduled');
    } catch (error) {
      console.error('[RevisionReminder] Scheduling failed:', error);
    }
  }
  
  /**
   * Check for surahs needing revision and send notification if found
   * Called by notification received listener
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
      
      // Send ACTUAL notification with results
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { 
            type: 'revision-needed',
            count,
            oldestDays: oldestSurah.daysSince,
            surahId: oldestSurah.surahId,
          },
          sound: true,
        },
        trigger: Platform.OS === 'android' ? { channelId: 'revision' } : null,
      });
      
      console.log('[RevisionReminder] Sent notification for', count, 'surahs');
    } catch (error) {
      console.error('[RevisionReminder] Check failed:', error);
    }
  }
  
  static async cancelRevisionReminders(): Promise<void> {
    await cancelNotification(this.REVISION_CHECK_TRIGGER_ID);
  }
}