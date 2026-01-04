import notifee from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';

// NOTE: Updated for your deployed worker name/account.
// Replace this value if you publish under a different Cloudflare subdomain or name.
export class PushNotificationService {
    /**
     * Get the current timezone offset string (e.g., "+0800" or "-0500")
     */
    static getTimezoneOffset(): string {
        const offsetMinutes = new Date().getTimezoneOffset();
        const sign = offsetMinutes > 0 ? '-' : '+'; // JS offset is inverted
        const absMinutes = Math.abs(offsetMinutes);
        const hours = Math.floor(absMinutes / 60);
        const minutes = absMinutes % 60;
        return `${sign}${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`;
    }

    /**
     * Initialize push notifications (permissions only, no auto-subscribe)
     */
    static async initialize() {
        try {

            // Request permission
            const authStatus = await messaging().requestPermission();
            const enabled =
                authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                authStatus === messaging.AuthorizationStatus.PROVISIONAL;

            if (!enabled) {
                console.log('[Push] Permission denied');
                return;
            }

            console.log('[Push] Permission granted');

            // Get FCM token (useful for debugging)
            const token = await messaging().getToken();
            console.log('[Push] FCM Token:', token);

            // Listen for token refresh
            messaging().onTokenRefresh(async (newToken) => {
                console.log('[Push] Token refreshed:', newToken);
            });

            // Handle foreground messages
            messaging().onMessage(async (remoteMessage) => {
                console.log('[Push] Foreground message:', remoteMessage);

                // Show local notification using Notifee
                await notifee.displayNotification({
                    title: remoteMessage.notification?.title || 'Notification',
                    body: remoteMessage.notification?.body || '',
                    data: remoteMessage.data,
                    android: {
                        channelId: 'default',
                        pressAction: {
                            id: 'default',
                        },
                    },
                    ios: {
                        sound: 'default',
                    },
                });
            });

            // Handle background/quit state messages
            messaging().setBackgroundMessageHandler(async (remoteMessage) => {
                console.log('[Push] Background message:', remoteMessage);
            });

            console.log('[Push] Initialization complete');
        } catch (error) {
            console.error('[Push] Initialization failed:', error);
        }
    }

    /**
     * Subscribe/Unsubscribe from Fasting Topic based on setting
     */
    static async syncFastingSubscription(enabled: boolean) {
        try {
            const offset = this.getTimezoneOffset();
            const topic = `fasting_${offset}`;
            const legacyTopic = 'fasting';

            if (enabled) {
                console.log(`[Push] Subscribing to: ${topic}`);
                await messaging().subscribeToTopic(topic);
                // Unsubscribe from legacy generic topic just in case
                await messaging().unsubscribeFromTopic(legacyTopic);
            } else {
                console.log(`[Push] Unsubscribing from: ${topic}`);
                await messaging().unsubscribeFromTopic(topic);
                await messaging().unsubscribeFromTopic(legacyTopic);
            }
        } catch (error) {
            console.error('[Push] Failed to sync fasting subscription:', error);
        }
    }

    /**
     * Subscribe/Unsubscribe from Daily Ayah Topic based on setting
     */
    static async syncAyahSubscription(enabled: boolean) {
        try {
            const offset = this.getTimezoneOffset();
            const topic = `daily_ayah_${offset}`;
            const legacyTopic = 'daily_ayah';

            if (enabled) {
                console.log(`[Push] Subscribing to: ${topic}`);
                await messaging().subscribeToTopic(topic);
                // Unsubscribe from legacy generic topic just in case
                await messaging().unsubscribeFromTopic(legacyTopic);
            } else {
                console.log(`[Push] Unsubscribing from: ${topic}`);
                await messaging().unsubscribeFromTopic(topic);
                await messaging().unsubscribeFromTopic(legacyTopic);
            }
        } catch (error) {
            console.error('[Push] Failed to sync ayah subscription:', error);
        }
    }

    /**
     * Get the current FCM token
     */
    static async getToken(): Promise<string | null> {
        try {
            const token = await messaging().getToken();
            return token;
        } catch (error) {
            console.error('[Push] Failed to get token:', error);
            return null;
        }
    }

    /**
     * Check if notifications are enabled
     */
    static async isEnabled(): Promise<boolean> {
        try {
            const authStatus = await messaging().hasPermission();
            return (
                authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                authStatus === messaging.AuthorizationStatus.PROVISIONAL
            );
        } catch (error) {
            console.error('[Push] Failed to check permission:', error);
            return false;
        }
    }
}
