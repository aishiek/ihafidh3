/**
 * Notification Service for FastingCalendar
 * Handles scheduling and managing fasting reminders
 * 
 * FIXED VERSION - Safe drop-in replacement
 */

import { CalendarDay, FastingNotificationSettings, FastingType } from '@/types/fasting';
import * as Notifications from 'expo-notifications';
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
      // Configure notification handler (MUST be set before scheduling)
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
      } catch (error) {
        console.warn('⚠️ Could not set notification handler:', error);
      }
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.warn('❌ Notification permission not granted. Status:', finalStatus);
        this.isInitialized = true;
        this.hasPermission = false;
        return false;
      }

      // Configure Android notification channel (CRITICAL for Android)
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
   * Setup Android notification channel (required for Android 8.0+)
   */
  private static async setupAndroidChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      await Notifications.setNotificationChannelAsync('fasting-reminders', {
        name: 'Fasting Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFD700',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
      console.log('✅ Android notification channel configured');
    } catch (error) {
      console.error('❌ Error setting up Android channel:', error);
      // Don't throw - allow iOS to continue working
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

      // Prepare notification content
      const notificationContent: Notifications.NotificationContentInput = {
        title: `🌙 ${fastingInfo.name} Reminder`,
        body: `${fastingInfo.name} fasting day is ${dayLabel}. ${fastingInfo.description}`,
        data: { 
          type: 'fasting_reminder', 
          fastingType, 
          date: day.date, 
          hijriDate: day.hijriDate.date 
        },
        sound: true,
      };

      // Add Android-specific channel via trigger (channelId belongs on trigger / channel-aware triggers)

      // Prepare trigger - use date-based trigger
      const trigger: Notifications.NotificationTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: notificationDate,
        ...(Platform.OS === 'android' && { channelId: 'fasting-reminders' }),
      };

      // Schedule the notification
      const scheduledId = await Notifications.scheduleNotificationAsync({
        identifier,
        content: notificationContent,
        trigger: trigger,
      });

      if (!scheduledId) {
        console.error(`❌ Failed to schedule notification: ${identifier}`);
        return null;
      }

      console.log(`✅ Scheduled: ${identifier} at ${notificationDate.toLocaleString()}`);
      return scheduledId;
    } catch (error) {
      console.error(`❌ Error scheduling notification for ${fastingType}:`, error);
      // Log full error details for debugging
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
        });
      }
      return null;
    }
  }

  /**
   * Verify scheduled notifications (debugging helper)
   */
  private static async verifyScheduledNotifications(): Promise<void> {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const fastingNotifications = scheduled.filter(
        n => n.identifier.startsWith('fasting_') || n.content.data?.type === 'fasting_reminder'
      );
      
      console.log(`📋 Verification: ${fastingNotifications.length} fasting notifications scheduled`);
      
      // Log details of each notification for debugging
      if (fastingNotifications.length > 0 && fastingNotifications.length <= 10) {
        fastingNotifications.forEach((n, index) => {
          const trigger = n.trigger as any;
          const triggerDate = trigger?.value || trigger?.date || 'unknown';
          console.log(`  ${index + 1}. ${n.identifier} -> ${triggerDate}`);
        });
      }
    } catch (error) {
      console.warn('⚠️ Could not verify scheduled notifications:', error);
    }
  }

  /**
   * Cancel all fasting notifications
   */
  static async cancelFastingNotifications(): Promise<void> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const fastingNotifications = scheduledNotifications.filter(
        notification =>
          notification.identifier.startsWith('fasting_') ||
          notification.content.data?.type === 'fasting_reminder'
      );

      let cancelledCount = 0;
      for (const notification of fastingNotifications) {
        try {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
          cancelledCount++;
        } catch (error) {
          console.error(`Failed to cancel notification ${notification.identifier}:`, error);
        }
      }

      console.log(`✅ Cancelled ${cancelledCount} of ${fastingNotifications.length} fasting notifications`);
    } catch (error) {
      console.error('❌ Error cancelling fasting notifications:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  static async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('✅ Cancelled all notifications');
    } catch (error) {
      console.error('❌ Error cancelling all notifications:', error);
    }
  }

  /**
   * Get scheduled fasting notifications
   */
  static async getScheduledFastingNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      return scheduledNotifications.filter(
        notification =>
          notification.identifier.startsWith('fasting_') ||
          notification.content.data?.type === 'fasting_reminder'
      );
    } catch (error) {
      console.error('❌ Error getting scheduled notifications:', error);
      return [];
    }
  }

  /**
   * Test notification (for debugging)
   * This sends an immediate notification to verify the setup works
   */
  static async sendTestNotification(): Promise<boolean> {
    try {
      const initialized = await this.initialize();
      if (!initialized || !this.hasPermission) {
        console.warn('❌ Cannot send test notification: not initialized or no permission');
        return false;
      }

      const notificationContent: Notifications.NotificationContentInput = {
        title: '🌙 Fasting Calendar Test',
        body: 'This is a test notification. If you see this, notifications are working!',
        data: { type: 'test' },
        sound: true,
      };

      // For immediate scheduling with Android channel, pass channel via trigger

      await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: null, // Immediate notification
      });

      console.log('✅ Test notification sent');
      return true;
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
      return false;
    }
  }

  /**
   * Get current permission status
   */
  static async getPermissionStatus(): Promise<string> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status;
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
      
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      console.log('Total Scheduled Notifications:', scheduled.length);
      
      const fasting = await this.getScheduledFastingNotifications();
      console.log('Fasting Notifications:', fasting.length);
      
      if (fasting.length > 0 && fasting.length <= 10) {
        fasting.forEach((n, i) => {
          const trigger = n.trigger as any;
          console.log(`  ${i + 1}. ${n.identifier}`);
          console.log(`     Trigger:`, trigger);
          console.log(`     Content:`, n.content.title);
        });
      }
    } catch (error) {
      console.error('Debug error:', error);
    }
    console.log('🔍 === End Debug Info ===');
  }
}