import notifee from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

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
            // Register device for remote messages (Required for iOS)
            if (Platform.OS === 'ios') {
                try {
                    // Modern Firebase versions use a function call, older ones use a property.
                    // (any casting used to satisfy both patterns and avoid lint errors)
                    const isReg = typeof (messaging() as any).isDeviceRegisteredForRemoteMessages === 'function'
                        ? (messaging() as any).isDeviceRegisteredForRemoteMessages()
                        : (messaging() as any).isDeviceRegisteredForRemoteMessages;

                    if (!isReg) {
                        await messaging().registerDeviceForRemoteMessages();
                    }
                } catch (e) {
                    console.log('[Push] iOS Remote registration failed (expected on simulator):', e);
                }
            }

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

            // Wait for FCM token to be ready
            // Skip if not registered (important for simulators/missing entitlements)
            const isRegistered = Platform.OS === 'ios'
                ? (typeof (messaging() as any).isDeviceRegisteredForRemoteMessages === 'function'
                    ? (messaging() as any).isDeviceRegisteredForRemoteMessages()
                    : (messaging() as any).isDeviceRegisteredForRemoteMessages)
                : true;

            if (Platform.OS === 'ios' && !isRegistered) {
                console.log('[Push] Device not registered for remote messages, skipping token fetch');
            } else {
                try {
                    const token = await messaging().getToken();
                    console.log('[Push] FCM Token:', token);
                } catch (tokenError) {
                    console.log('[Push] Failed to get token (expected on simulator):', tokenError);
                }
            }

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
            if (Platform.OS === 'ios') {
                try {
                    const isReg = typeof (messaging() as any).isDeviceRegisteredForRemoteMessages === 'function'
                        ? (messaging() as any).isDeviceRegisteredForRemoteMessages()
                        : (messaging() as any).isDeviceRegisteredForRemoteMessages;

                    if (!isReg) {
                        await messaging().registerDeviceForRemoteMessages();
                    }

                    const isRegPost = typeof (messaging() as any).isDeviceRegisteredForRemoteMessages === 'function'
                        ? (messaging() as any).isDeviceRegisteredForRemoteMessages()
                        : (messaging() as any).isDeviceRegisteredForRemoteMessages;

                    if (!isRegPost) {
                        console.log('[Push] iOS Device not registered for remote messages, skipping sync');
                        return;
                    }

                    const apnsToken = await messaging().getAPNSToken();
                    if (!apnsToken) {
                        console.log('[Push] No APNS token available yet, skipping sync');
                        return;
                    }
                } catch (apnsError) {
                    console.log('[Push] APNS token fetch failed (not registered?):', apnsError);
                    return;
                }
            }

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
            if (Platform.OS === 'ios') {
                try {
                    const isReg = typeof (messaging() as any).isDeviceRegisteredForRemoteMessages === 'function'
                        ? (messaging() as any).isDeviceRegisteredForRemoteMessages()
                        : (messaging() as any).isDeviceRegisteredForRemoteMessages;

                    if (!isReg) {
                        await messaging().registerDeviceForRemoteMessages();
                    }

                    const isRegPost = typeof (messaging() as any).isDeviceRegisteredForRemoteMessages === 'function'
                        ? (messaging() as any).isDeviceRegisteredForRemoteMessages()
                        : (messaging() as any).isDeviceRegisteredForRemoteMessages;

                    if (!isRegPost) {
                        console.log('[Push] iOS Device not registered for remote messages, skipping sync');
                        return;
                    }

                    const apnsToken = await messaging().getAPNSToken();
                    if (!apnsToken) {
                        console.log('[Push] No APNS token available yet, skipping sync');
                        return;
                    }
                } catch (apnsError) {
                    console.log('[Push] APNS token fetch failed (not registered?):', apnsError);
                    return;
                }
            }

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
