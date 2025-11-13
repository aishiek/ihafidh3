import * as Notifications from 'expo-notifications';

export class AyahNotificationService {
  private static isInitialized = false;

  static async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
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
        console.log('[Notifications] Ayah handler configured');
      }

      if (!Notifications?.requestPermissionsAsync) {
        console.warn('[Notifications] requestPermissionsAsync unavailable');
        this.isInitialized = false;
        return false;
      }

      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('❌ Notification permission not granted');
        this.isInitialized = false;
        return false;
      }

      this.isInitialized = true;
      console.log('📱 Ayah notification service initialized');
      return true;
    } catch (e) {
      console.error('[AyahNotificationService] init error:', e);
      this.isInitialized = false;
      return false;
    }
  }

  static async scheduleDailyAyahReminder(time: string): Promise<string | null> {
    try {
      if (!this.isInitialized) {
        const ok = await this.initialize();
        if (!ok) return null;
      }
      if (!Notifications?.scheduleNotificationAsync) return null;

      // Cancel any existing daily ayah first to avoid duplicates
      await this.cancelDailyAyahReminder();

      const [hourStr, minuteStr] = time.split(':');
      const hour = Number(hourStr);
      const minute = Number(minuteStr);

      const identifier = 'daily_ayah';

      // Use correct DailyTriggerInput format for daily repeating notifications
      // This ensures the notification repeats daily at the specified time
      const trigger: Notifications.DailyTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      };

      const scheduledId = await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: '📖 Ayah of the Day',
          body: "Tap to open today's verse in iHafidh.",
          data: { type: 'daily_ayah' },
        },
        trigger,
      });

      // Verify scheduling
      try {
        if (Notifications?.getAllScheduledNotificationsAsync) {
          const all = await Notifications.getAllScheduledNotificationsAsync();
          const found = all.find(n => n.identifier === scheduledId || n.identifier === identifier);
          if (found) console.log('📱 Scheduled daily ayah notification at', time);
          else console.warn('⚠️ Scheduled daily ayah notification not present in registry');
        }
      } catch (verifyErr) {
        console.warn('⚠️ Could not verify daily ayah scheduling', verifyErr);
      }

      return scheduledId || identifier;
    } catch (e) {
      console.error('[AyahNotificationService] schedule error:', e);
      return null;
    }
  }

  static async cancelDailyAyahReminder(): Promise<void> {
    try {
      if (!Notifications?.getAllScheduledNotificationsAsync || !Notifications?.cancelScheduledNotificationAsync) return;
      const all = await Notifications.getAllScheduledNotificationsAsync();
      const targets = all.filter(n => n.identifier === 'daily_ayah' || n.content.data?.type === 'daily_ayah');
      for (const n of targets) {
        try { await Notifications.cancelScheduledNotificationAsync(n.identifier); } catch {}
      }
      if (targets.length) console.log(`📱 Cancelled ${targets.length} daily ayah notifications`);
    } catch (e) {
      console.error('[AyahNotificationService] cancel error:', e);
    }
  }
}
