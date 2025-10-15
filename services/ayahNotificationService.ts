import * as Notifications from 'expo-notifications';

export class AyahNotificationService {
  private static isInitialized = false;

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
      console.log('📱 Ayah notification service initialized');
    } catch (e) {
      console.error('[AyahNotificationService] init error:', e);
    }
  }

  static async scheduleDailyAyahReminder(time: string): Promise<string | null> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      if (!Notifications?.scheduleNotificationAsync) return null;

      // Cancel any existing daily ayah first to avoid duplicates
      await this.cancelDailyAyahReminder();

      const [hourStr, minuteStr] = time.split(':');
      const hour = Number(hourStr);
      const minute = Number(minuteStr);

      const identifier = 'daily_ayah';
      // Prefer typed daily trigger if available, otherwise fallback to legacy calendar trigger shape
      const trigger: any = (Notifications as any).DailyTriggerInput
        ? ({ type: 'daily', hour, minute } as any)
        : ({ hour, minute, repeats: true } as any);

      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: '📖 Ayah of the Day',
          body: 'Tap to open today\'s verse in iHafidh.',
          data: { type: 'daily_ayah' },
        },
        trigger,
      });
      console.log('📱 Scheduled daily ayah notification at', time);
      return identifier;
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
