import {
    cancelNotification as cancelNotificationService,
    requestNotificationPermissions as requestPerms,
    RevisionNotificationService,
    scheduleNotificationAtDate
} from '@/services/NotificationService';

// Backwards compatibility wrappers
export async function requestNotificationPermissions() {
  return requestPerms();
}

export async function scheduleNotification({ 
  title, 
  body, 
  date, 
  id 
}: { 
  title: string;
  body: string;
  date: Date;
  id: string;
}) {
  return scheduleNotificationAtDate({
    id,
    title,
    body,
    date,
    channelId: 'default',
  });
}

export async function cancelNotification(id: string) {
  return cancelNotificationService(id);
}

export async function scheduleRevisionReminders({ 
  dailyIncomplete, 
  weeklyIncomplete 
}: { 
  dailyIncomplete: boolean;
  weeklyIncomplete: boolean;
}) {
  await RevisionNotificationService.scheduleDailyReminder(dailyIncomplete);
  await RevisionNotificationService.scheduleWeeklyReminder(weeklyIncomplete);
}
