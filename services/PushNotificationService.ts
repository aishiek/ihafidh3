import notifee from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';

// NOTE: Updated for your deployed worker name/account.
// Replace this value if you publish under a different Cloudflare subdomain or name.
const TOPICS = ['fasting', 'daily_ayah'];

export class PushNotificationService {
    /**
     * Initialize push notifications and subscribe to topics
     */
    static async initialize() {
        try {
            console.log('[Push] Initializing Firebase Cloud Messaging...');

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

            // Subscribe to topics
            for (const topic of TOPICS) {
                await messaging().subscribeToTopic(topic);
                console.log(`[Push] Subscribed to topic: ${topic}`);
            }

            // Get FCM token (useful for debugging, though not needed for topics)
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
                        channelId: 'default', // Make sure this channel exists in Notifee setup
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
