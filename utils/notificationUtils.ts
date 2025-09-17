import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Safe accessor helpers
function has(fn: any): fn is Function { return typeof fn === 'function'; }

// Call this at app startup
export async function requestNotificationPermissions() {
  try {
    if (!Notifications || !has(Notifications.requestPermissionsAsync)) return false;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('[notifications] requestPermission failed', e);
    return false;
  }
}

// Schedule a notification at a specific date/time
export async function scheduleNotification({ title, body, date, id }: { title: string, body: string, date: Date, id: string }) {
  try {
    if (!Notifications) return null;
    if (has(Notifications.cancelScheduledNotificationAsync)) {
      try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
    }
    if (!has(Notifications.scheduleNotificationAsync)) return null;
    const trigger: Notifications.DateTriggerInput = { date } as any; // cast to satisfy type in SDK variations
    return await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger,
      identifier: id,
    });
  } catch (e) {
    console.warn('[notifications] schedule failed', e);
    return null;
  }
}

// Cancel a scheduled notification by id
export async function cancelNotification(id: string) {
  try {
    if (Notifications && has(Notifications.cancelScheduledNotificationAsync)) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
  } catch {}
}

// Helper to schedule daily/weekly reminders
export async function scheduleRevisionReminders({ dailyIncomplete, weeklyIncomplete }: { dailyIncomplete: boolean, weeklyIncomplete: boolean }) {
  try {
    if (!Notifications) return;
    const now = new Date();
    if (dailyIncomplete) {
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 0, 0);
      await scheduleNotification({
        title: 'Daily Revision Reminder',
        body: 'You haven’t completed your daily Quran revision goal. Open iHafidh to stay on track!',
        date: endOfDay,
        id: 'daily-revision-reminder',
      });
    } else {
      await cancelNotification('daily-revision-reminder');
    }
    if (weeklyIncomplete) {
      const endOfWeek = new Date(now);
      endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
      endOfWeek.setHours(23, 59, 0, 0);
      await scheduleNotification({
        title: 'Weekly Revision Reminder',
        body: 'Weekly revision goal not achieved. Review your progress and keep your streak alive!',
        date: endOfWeek,
        id: 'weekly-revision-reminder',
      });
    } else {
      await cancelNotification('weekly-revision-reminder');
    }
  } catch (e) {
    console.warn('[notifications] scheduleRevisionReminders failed', e);
  }
}
