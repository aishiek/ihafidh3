import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Call this at app startup
export async function requestNotificationPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Schedule a notification at a specific date/time
export async function scheduleNotification({ title, body, date, id }: { title: string, body: string, date: Date, id: string }) {
  await Notifications.cancelScheduledNotificationAsync(id); // Cancel previous if exists
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: date,
    identifier: id,
  });
}

// Cancel a scheduled notification by id
export async function cancelNotification(id: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}

// Helper to schedule daily/weekly reminders
export async function scheduleRevisionReminders({ dailyIncomplete, weeklyIncomplete }: { dailyIncomplete: boolean, weeklyIncomplete: boolean }) {
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
    // Schedule for Sunday 23:59
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
}
