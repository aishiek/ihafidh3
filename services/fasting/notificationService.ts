/**
 * Notification Service for FastingCalendar
 * Handles scheduling and managing fasting reminders
 */

import { CalendarDay, FastingNotificationSettings, FastingType } from '@/types/fasting';
import * as Notifications from 'expo-notifications';

export class FastingNotificationService {
  private static isInitialized = false;

  /**
   * Initialize notification service
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (Notifications?.setNotificationHandler) {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
      }

      if (Notifications?.requestPermissionsAsync) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Notification permission not granted');
          return;
        }
      } else {
        console.warn('[Notifications] requestPermissionsAsync unavailable');
        return;
      }

      this.isInitialized = true;
      console.log('📱 Fasting notification service initialized');
    } catch (error) {
      console.error('Error initializing notification service:', error);
    }
  }

  /**
   * Schedule fasting reminders for calendar days
   */
  static async scheduleFastingReminders(
    calendarDays: CalendarDay[],
    notificationSettings: FastingNotificationSettings
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!notificationSettings.enabled) {
      console.log('📱 Fasting notifications disabled');
      return;
    }

    if (!Notifications?.scheduleNotificationAsync) {
      console.warn('[Notifications] scheduleNotificationAsync unavailable');
      return;
    }

    try {
      await this.cancelFastingNotifications();
      const scheduledNotifications: string[] = [];
      for (const day of calendarDays) {
        for (const fastingType of day.fastingTypes) {
          const typeSettings = notificationSettings.fastingTypes[fastingType];
          if (!typeSettings?.enabled) continue;
          const notificationId = await this.scheduleNotificationForDay(
            day,
            fastingType,
            typeSettings.time || notificationSettings.defaultTime,
            typeSettings.beforeDays || notificationSettings.defaultBeforeDays
          );
          if (notificationId) scheduledNotifications.push(notificationId);
        }
      }
      console.log(`📱 Scheduled ${scheduledNotifications.length} fasting notifications`);
    } catch (error) {
      console.error('Error scheduling fasting reminders:', error);
    }
  }

  /**
   * Schedule notification for a specific day
   */
  private static async scheduleNotificationForDay(
    day: CalendarDay,
    fastingType: FastingType,
    time: string,
    beforeDays: number
  ): Promise<string | null> {
    if (!Notifications?.scheduleNotificationAsync) return null;
    try {
      const fastingDate = new Date(day.date);
      const notificationDate = new Date(fastingDate);
      notificationDate.setDate(notificationDate.getDate() - beforeDays);
      const [hours, minutes] = time.split(':').map(Number);
      notificationDate.setHours(hours, minutes, 0, 0);
      if (notificationDate <= new Date()) return null;
      const fastingInfo = this.getFastingTypeInfo(fastingType);
      const identifier = `fasting_${fastingType}_${day.date}`;
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: `🌙 ${fastingInfo.name} Reminder`,
            body: `Tomorrow is ${fastingInfo.name} fasting day. ${fastingInfo.description}`,
            data: { type: 'fasting_reminder', fastingType, date: day.date, hijriDate: day.hijriDate.date },
        },
        trigger: null,
      });
      return identifier;
    } catch (error) {
      console.error(`Error scheduling notification for ${fastingType}:`, error);
      return null;
    }
  }

  /**
   * Cancel all fasting notifications
   */
  static async cancelFastingNotifications(): Promise<void> {
    if (!Notifications?.getAllScheduledNotificationsAsync || !Notifications?.cancelScheduledNotificationAsync) return;
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const fastingNotifications = scheduledNotifications.filter(
        notification =>
          notification.identifier.startsWith('fasting_') ||
          notification.content.data?.type === 'fasting_reminder'
      );
      for (const notification of fastingNotifications) {
        try { await Notifications.cancelScheduledNotificationAsync(notification.identifier); } catch {}
      }
      console.log(`📱 Cancelled ${fastingNotifications.length} fasting notifications`);
    } catch (error) {
      console.error('Error cancelling fasting notifications:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  static async cancelAllNotifications(): Promise<void> {
    if (!Notifications?.cancelAllScheduledNotificationsAsync) return;
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('📱 Cancelled all notifications');
    } catch (error) {
      console.error('Error cancelling all notifications:', error);
    }
  }

  /**
   * Get scheduled fasting notifications
   */
  static async getScheduledFastingNotifications(): Promise<Notifications.NotificationRequest[]> {
    if (!Notifications?.getAllScheduledNotificationsAsync) return [];
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      return scheduledNotifications.filter(
        notification =>
          notification.identifier.startsWith('fasting_') ||
          notification.content.data?.type === 'fasting_reminder'
      );
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      return [];
    }
  }

  /**
   * Test notification (for debugging)
   */
  static async sendTestNotification(): Promise<void> {
    if (!Notifications?.scheduleNotificationAsync) return;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌙 Fasting Calendar Test',
          body: 'This is a test notification from the Fasting Calendar feature.',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  }

  /**
   * Get fasting type information
   */
  private static getFastingTypeInfo(fastingType: FastingType): { name: string; description: string } {
    const fastingTypeMap = {
      [FastingType.AYYAMUL_BIDH]: { name: 'Ayyamul Bidh', description: '13th, 14th, 15th of Hijri month' },
      [FastingType.MONDAY_THURSDAY]: { name: 'Monday & Thursday', description: 'Sunnah fasting days' },
      [FastingType.MUHARRAM]: { name: 'Muharram', description: 'Sacred month fasting' },
      [FastingType.ASHURA]: { name: 'Ashura', description: '10th of Muharram' },
      [FastingType.ARAFAH]: { name: 'Arafah', description: '9th of Dhul Hijjah' },
      [FastingType.SHAWWAL]: { name: 'Shawwal', description: '6 days of Shawwal' },
      [FastingType.DHUL_HIJJAH_FIRST_TEN]: { name: 'First 10 of Dhul Hijjah', description: 'First 10 days of Dhul Hijjah' },
      [FastingType.RAMADAN]: { name: 'Ramadan', description: 'Holy month of fasting' },
    };

    return fastingTypeMap[fastingType] || { name: 'Unknown', description: 'Unknown fasting type' };
  }
}
