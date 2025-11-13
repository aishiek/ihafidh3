import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ============================================================================
// INITIALIZATION (Call ONCE at app startup)
// ============================================================================

let isInitialized = false;

export async function initializeNotifications(): Promise<void> {
  if (isInitialized) {
    console.log('[NotificationService] Already initialized, skipping');
    return;
  }

  try {
    // Set notification handler ONCE
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    console.log('[NotificationService] Handler set');

    // Create Android notification channels
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFD700',
      });

      await Notifications.setNotificationChannelAsync('fasting', {
        name: 'Fasting Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFD700',
      });

      await Notifications.setNotificationChannelAsync('ayah', {
        name: 'Daily Ayah',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFD700',
      });

      await Notifications.setNotificationChannelAsync('revision', {
        name: 'Revision Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFD700',
      });

      console.log('[NotificationService] Android channels created');
    }

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
    // Validate date is in future
    if (!isDateInFuture(date)) {
      console.warn('[NotificationService] Cannot schedule notification in the past:', {
        id,
        date: date.toISOString(),
        now: new Date().toISOString(),
      });
      return null;
    }

    // Cancel existing notification with same ID
    await cancelNotification(id);

    // Schedule new notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title,
        body,
        data,
        sound: true,
        ...(Platform.OS === 'android' && { channelId }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      } as any,
    });

    console.log('[NotificationService] Scheduled notification:', {
      id,
      notificationId,
      date: date.toISOString(),
      channelId,
    });

    return notificationId;
  } catch (error) {
    console.error('[NotificationService] Failed to schedule notification:', error);
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
}: {
  id: string;
  title: string;
  body: string;
  hour: number;
  minute: number;
  channelId?: string;
  data?: Record<string, any>;
}): Promise<string | null> {
  try {
    // Validate hour and minute
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      console.warn('[NotificationService] Invalid hour or minute:', { hour, minute });
      return null;
    }

    // Cancel existing notification with same ID
    await cancelNotification(id);

    // Schedule daily notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title,
        body,
        data,
        sound: true,
        ...(Platform.OS === 'android' && { channelId }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      } as any,
    });

    console.log('[NotificationService] Scheduled daily notification:', {
      id,
      notificationId,
      hour,
      minute,
      channelId,
    });

    return notificationId;
  } catch (error) {
    console.error('[NotificationService] Failed to schedule daily notification:', error);
    return null;
  }
}

export async function cancelNotification(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
    console.log('[NotificationService] Cancelled notification:', id);
  } catch (error) {
    // Silent fail - notification might not exist
  }
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[NotificationService] Cancelled all notifications');
  } catch (error) {
    console.error('[NotificationService] Failed to cancel all notifications:', error);
  }
}

export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  try {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log('[NotificationService] Scheduled notifications:', notifications.length);
    return notifications;
  } catch (error) {
    console.error('[NotificationService] Failed to get scheduled notifications:', error);
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
      trigger: null, // Immediate
    });
    console.log('[NotificationService] Sent test notification');
  } catch (error) {
    console.error('[NotificationService] Failed to send test notification:', error);
  }
}

// ============================================================================
// FASTING NOTIFICATION SERVICE
// ============================================================================

export class FastingNotificationService {
  static async initialize(): Promise<void> {
    // No-op - handled by initializeNotifications()
    console.log('[FastingNotificationService] Using centralized initialization');
  }

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
    date: string; // Format: YYYY-MM-DD
    beforeDays?: number;
    time?: string; // Format: HH:mm
  }): Promise<void> {
    try {
      // Parse time
      const [hourStr, minuteStr] = time.split(':');
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);

      if (isNaN(hour) || isNaN(minute)) {
        console.warn('[FastingNotificationService] Invalid time format:', time);
        return;
      }

      // Parse fasting date and subtract beforeDays
      const fastingDate = new Date(date);
      if (isNaN(fastingDate.getTime())) {
        console.warn('[FastingNotificationService] Invalid date format:', date);
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
      console.error('[FastingNotificationService] Failed to schedule reminder:', error);
    }
  }

  static async cancelAllFastingReminders(): Promise<void> {
    try {
      const scheduled = await getScheduledNotifications();
      const fastingNotifications = scheduled.filter(n => n.identifier.startsWith('fasting_'));

      for (const notification of fastingNotifications) {
        await cancelNotification(notification.identifier);
      }

      console.log('[FastingNotificationService] Cancelled all fasting reminders:', fastingNotifications.length);
    } catch (error) {
      console.error('[FastingNotificationService] Failed to cancel fasting reminders:', error);
    }
  }

  static async cancelReminder(id: string): Promise<void> {
    await cancelNotification(id);
  }
}

// ============================================================================
// AYAH NOTIFICATION SERVICE
// ============================================================================

export class AyahNotificationService {
  private static readonly DAILY_AYAH_ID = 'daily_ayah';

  static async initialize(): Promise<void> {
    // No-op - handled by initializeNotifications()
    console.log('[AyahNotificationService] Using centralized initialization');
  }

  static async scheduleDailyReminder(time: string): Promise<void> {
    try {
      // Parse time string "HH:mm"
      const [hourStr, minuteStr] = time.split(':');
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);

      if (isNaN(hour) || isNaN(minute)) {
        console.warn('[AyahNotificationService] Invalid time format:', time);
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
      console.error('[AyahNotificationService] Failed to schedule daily reminder:', error);
    }
  }

  static async cancelDailyReminder(): Promise<void> {
    await cancelNotification(this.DAILY_AYAH_ID);
    console.log('[AyahNotificationService] Cancelled daily reminder');
  }

  static async cancelDailyAyahReminder(): Promise<void> {
    await this.cancelDailyReminder();
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
        console.log('[RevisionNotificationService] Daily goal complete - reminder cancelled');
        return;
      }

      // Schedule for end of day (23:59)
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 0, 0);

      // Only schedule if end of day is in future
      if (!isDateInFuture(endOfDay)) {
        console.log('[RevisionNotificationService] End of day has passed - skipping daily reminder');
        return;
      }

      await scheduleNotificationAtDate({
        id: this.DAILY_REVISION_ID,
        title: '📚 Daily Revision Reminder',
        body: "You haven't completed your daily Quran revision goal. Open iHafidh to stay on track!",
        date: endOfDay,
        channelId: 'revision',
        data: {
          type: 'daily_revision',
        },
      });
    } catch (error) {
      console.error('[RevisionNotificationService] Failed to schedule daily reminder:', error);
    }
  }

  static async scheduleWeeklyReminder(incomplete: boolean): Promise<void> {
    try {
      if (!incomplete) {
        await cancelNotification(this.WEEKLY_REVISION_ID);
        console.log('[RevisionNotificationService] Weekly goal complete - reminder cancelled');
        return;
      }

      // Calculate end of week (Sunday 23:59)
      const now = new Date();
      const endOfWeek = new Date(now);
      const daysUntilSunday = 7 - now.getDay();
      endOfWeek.setDate(now.getDate() + daysUntilSunday);
      endOfWeek.setHours(23, 59, 0, 0);

      // Only schedule if end of week is in future
      if (!isDateInFuture(endOfWeek)) {
        console.log('[RevisionNotificationService] End of week has passed - skipping weekly reminder');
        return;
      }

      await scheduleNotificationAtDate({
        id: this.WEEKLY_REVISION_ID,
        title: '📅 Weekly Revision Reminder',
        body: 'Weekly revision goal not achieved. Review your progress and keep your streak alive!',
        date: endOfWeek,
        channelId: 'revision',
        data: {
          type: 'weekly_revision',
        },
      });
    } catch (error) {
      console.error('[RevisionNotificationService] Failed to schedule weekly reminder:', error);
    }
  }

  static async cancelDailyReminder(): Promise<void> {
    await cancelNotification(this.DAILY_REVISION_ID);
  }

  static async cancelWeeklyReminder(): Promise<void> {
    await cancelNotification(this.WEEKLY_REVISION_ID);
  }

  static async cancelAllReminders(): Promise<void> {
    await this.cancelDailyReminder();
    await this.cancelWeeklyReminder();
    console.log('[RevisionNotificationService] Cancelled all revision reminders');
  }
}
