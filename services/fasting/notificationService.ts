/**
 * Notification Service for FastingCalendar
 * Handles scheduling and managing fasting reminders
 * 
 * MIGRATED TO NOTIFEE
 */

import { CalendarDay, FastingNotificationSettings, FastingType } from '@/types/fasting';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  TimestampTrigger,
  TriggerType
} from '@notifee/react-native';
import { Platform } from 'react-native';

export class FastingNotificationService {
  private static isInitialized = false;
  private static hasPermission = false;

  /**
   * Initialize notification service
   * Returns true if initialization succeeded and permissions granted.
   */
  static async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return this.hasPermission;
    }

    try {
      // Request permissions
      const settings = await notifee.requestPermission();

      if (settings.authorizationStatus < 1) {
        console.warn('❌ Notification permission not granted. Status:', settings.authorizationStatus);
        this.isInitialized = true;
        this.hasPermission = false;
        return false;
      }

      // Configure Android notification channel
      if (Platform.OS === 'android') {
        await this.setupAndroidChannel();
      }

      this.isInitialized = true;
      this.hasPermission = true;
      console.log('✅ Fasting notification service initialized with permissions');
      return true;
    } catch (error) {
      console.error('❌ Error initializing notification service:', error);
      this.isInitialized = true;
      this.hasPermission = false;
      return false;
    }
  }

  /**
   * Setup Android notification channel
   */
  private static async setupAndroidChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      await notifee.createChannel({
        id: 'fasting-reminders',
        name: 'Fasting Reminders',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        lightColor: '#FFD700',
        vibration: true,
        sound: 'default',
      });
      console.log('✅ Android notification channel configured');
    } catch (error) {
      console.error('❌ Error setting up Android channel:', error);
    }
  }

  /**
   * Schedule fasting reminders for calendar days
   */
  static async scheduleFastingReminders(
    calendarDays: CalendarDay[],
    notificationSettings: FastingNotificationSettings
  ): Promise<void> {
    // Initialize if needed
    const initialized = await this.initialize();
    if (!initialized || !this.hasPermission) {
      console.warn('❌ Cannot schedule notifications: not initialized or no permission');
      return;
    }

    if (!notificationSettings.enabled) {
      console.log('📱 Fasting notifications disabled in settings');
      return;
    }

    try {
      // Cancel existing notifications first
      await this.cancelFastingNotifications();

      const scheduledNotifications: string[] = [];
      const failedNotifications: string[] = [];
      const now = new Date();

      for (const day of calendarDays) {
        for (const fastingType of day.fastingTypes) {
          const typeSettings = notificationSettings.fastingTypes[fastingType];
          if (!typeSettings?.enabled) {
            continue;
          }

          // Calculate notification time
          const fastingDate = new Date(day.date);
          const notificationDate = new Date(fastingDate);
          notificationDate.setDate(notificationDate.getDate() - (typeSettings.beforeDays || notificationSettings.defaultBeforeDays));

          const [hours, minutes] = (typeSettings.time || notificationSettings.defaultTime).split(':').map(Number);
          notificationDate.setHours(hours, minutes, 0, 0);

          // Skip past notifications
          if (notificationDate <= now) {
            console.log(`⏭️ Skipping past notification for ${fastingType} on ${day.date}`);
            continue;
          }

          // Schedule the notification
          const notificationId = await this.scheduleNotificationForDay(
            day,
            fastingType,
            typeSettings.time || notificationSettings.defaultTime,
            typeSettings.beforeDays || notificationSettings.defaultBeforeDays,
            notificationDate
          );

          if (notificationId) {
            scheduledNotifications.push(notificationId);
          } else {
            failedNotifications.push(`${fastingType}_${day.date}`);
          }
        }
      }

      console.log(`✅ Scheduled ${scheduledNotifications.length} fasting notifications`);
      if (failedNotifications.length > 0) {
        console.warn(`⚠️ Failed to schedule ${failedNotifications.length} notifications:`, failedNotifications);
      }

      // Verify scheduled notifications
      await this.verifyScheduledNotifications();
    } catch (error) {
      console.error('❌ Error scheduling fasting reminders:', error);
    }
  }

  /**
   * Schedule notification for a specific day
   */
  private static async scheduleNotificationForDay(
    day: CalendarDay,
    fastingType: FastingType,
    time: string,
    beforeDays: number,
    notificationDate: Date
  ): Promise<string | null> {
    try {
      // Double-check notification date is in the future
      const now = new Date();
      if (notificationDate <= now) {
        console.warn(`⚠️ Cannot schedule past notification. Date: ${notificationDate.toISOString()}, Now: ${now.toISOString()}`);
        return null;
      }

      const fastingInfo = this.getFastingTypeInfo(fastingType);
      const identifier = `fasting_${fastingType}_${day.date}`;

      // Human-friendly day label
      const daysUntil = beforeDays;
      const dayLabel = daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`;

      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: notificationDate.getTime(),
      };

      await notifee.createTriggerNotification(
        {
          id: identifier,
          title: `🌙 ${fastingInfo.name} Reminder`,
          body: `${fastingInfo.name} fasting day is ${dayLabel}. ${fastingInfo.description}`,
          data: {
            type: 'fasting_reminder',
            fastingType,
            date: day.date,
            hijriDate: day.hijriDate.date
          },
          android: {
            channelId: 'fasting-reminders',
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

      console.log(`✅ Scheduled: ${identifier} at ${notificationDate.toLocaleString()}`);
      return identifier;
    } catch (error) {
      console.error(`❌ Error scheduling notification for ${fastingType}:`, error);
      return null;
    }
  }

  /**
   * Verify scheduled notifications (debugging helper)
   */
  private static async verifyScheduledNotifications(): Promise<void> {
    try {
      const ids = await notifee.getTriggerNotificationIds();
      const fastingIds = ids.filter(id => id.startsWith('fasting_'));

      console.log(`📋 Verification: ${fastingIds.length} fasting notifications scheduled`);
    } catch (error) {
      console.warn('⚠️ Could not verify scheduled notifications:', error);
    }
  }

  /**
   * Cancel all fasting notifications
   */
  static async cancelFastingNotifications(): Promise<void> {
    try {
      const ids = await notifee.getTriggerNotificationIds();
      const fastingIds = ids.filter(id => id.startsWith('fasting_'));

      let cancelledCount = 0;
      for (const id of fastingIds) {
        try {
          await notifee.cancelNotification(id);
          await notifee.cancelTriggerNotification(id);
          cancelledCount++;
        } catch (error) {
          console.error(`Failed to cancel notification ${id}:`, error);
        }
      }

      console.log(`✅ Cancelled ${cancelledCount} of ${fastingIds.length} fasting notifications`);
    } catch (error) {
      console.error('❌ Error cancelling fasting notifications:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  static async cancelAllNotifications(): Promise<void> {
    try {
      await notifee.cancelAllNotifications();
      console.log('✅ Cancelled all notifications');
    } catch (error) {
      console.error('❌ Error cancelling all notifications:', error);
    }
  }

  /**
   * Get scheduled fasting notifications
   * Returns IDs only now
   */
  static async getScheduledFastingNotifications(): Promise<string[]> {
    try {
      const ids = await notifee.getTriggerNotificationIds();
      return ids.filter(id => id.startsWith('fasting_'));
    } catch (error) {
      console.error('❌ Error getting scheduled notifications:', error);
      return [];
    }
  }

  /**
   * Test notification (for debugging)
   */
  static async sendTestNotification(): Promise<boolean> {
    try {
      const initialized = await this.initialize();
      if (!initialized || !this.hasPermission) {
        console.warn('❌ Cannot send test notification: not initialized or no permission');
        return false;
      }

      await notifee.displayNotification({
        title: '🌙 Fasting Calendar Test',
        body: 'This is a test notification. If you see this, notifications are working!',
        data: { type: 'test' },
        android: {
          channelId: 'fasting-reminders',
          pressAction: {
            id: 'default',
          },
        },
      });

      console.log('✅ Test notification sent');
      return true;
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
      return false;
    }
  }

  /**
   * Get current permission status
   */
  static async getPermissionStatus(): Promise<string> {
    try {
      const settings = await notifee.getNotificationSettings();
      return settings.authorizationStatus.toString();
    } catch (error) {
      console.error('❌ Error getting permission status:', error);
      return 'unknown';
    }
  }

  /**
   * Get fasting type information
   */
  private static getFastingTypeInfo(fastingType: FastingType): { name: string; description: string } {
    const fastingTypeMap = {
      [FastingType.AYYAMUL_BIDH]: {
        name: 'Ayyamul Bidh',
        description: '13th, 14th, 15th of Hijri month'
      },
      [FastingType.MONDAY_THURSDAY]: {
        name: 'Monday & Thursday',
        description: 'Sunnah fasting days'
      },
      [FastingType.MUHARRAM]: {
        name: 'Muharram',
        description: 'Sacred month fasting'
      },
      [FastingType.ASHURA]: {
        name: 'Ashura',
        description: '10th of Muharram'
      },
      [FastingType.ARAFAH]: {
        name: 'Arafah',
        description: '9th of Dhul Hijjah'
      },
      [FastingType.SHAWWAL]: {
        name: 'Shawwal',
        description: '6 days of Shawwal'
      },
      [FastingType.DHUL_HIJJAH_FIRST_TEN]: {
        name: 'First 10 of Dhul Hijjah',
        description: 'First 10 days of Dhul Hijjah'
      },
      [FastingType.RAMADAN]: {
        name: 'Ramadan',
        description: 'Holy month of fasting'
      },
    };

    return fastingTypeMap[fastingType] || {
      name: 'Unknown',
      description: 'Unknown fasting type'
    };
  }

  /**
   * Debug helper: Log all information about notification setup
   */
  static async debugNotificationSetup(): Promise<void> {
    console.log('🔍 === Notification Debug Info ===');
    console.log('Platform:', Platform.OS);
    console.log('Initialized:', this.isInitialized);
    console.log('Has Permission:', this.hasPermission);

    try {
      const status = await this.getPermissionStatus();
      console.log('Permission Status:', status);

      const ids = await notifee.getTriggerNotificationIds();
      console.log('Total Scheduled Notifications:', ids.length);

      const fastingIds = await this.getScheduledFastingNotifications();
      console.log('Fasting Notifications:', fastingIds.length);

      if (fastingIds.length > 0 && fastingIds.length <= 10) {
        fastingIds.forEach((id, i) => {
          console.log(`  ${i + 1}. ${id}`);
        });
      }
    } catch (error) {
      console.error('Debug error:', error);
    }
    console.log('🔍 === End Debug Info ===');
  }
}