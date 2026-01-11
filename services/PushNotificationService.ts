import notifee, { AndroidImportance } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

export class PushNotificationService {
    /**
     * Get the current timezone offset string (e.g., "0800" or "-0500")
     * Format: No '+' prefix for positive offsets (FCM compatibility)
     * Handles 30-minute offsets correctly (e.g., "0530" for India)
     */
    static getTimezoneOffset(): string {
        const offsetMinutes = new Date().getTimezoneOffset();
        const sign = offsetMinutes > 0 ? '-' : ''; 
        const absMinutes = Math.abs(offsetMinutes);
        const hours = Math.floor(absMinutes / 60);
        const minutes = absMinutes % 60;
        // Returns format: 0800 or -0500 or 0530
        return `${sign}${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`;
    }

    /**
     * Helper to ensure iOS is ready for remote work
     */
    private static async ensureIosRegistered(): Promise<boolean> {
        if (Platform.OS !== 'ios') return true;
        
        try {
            // FIX: Call as a function, not a property
            const isReg = await messaging().isDeviceRegisteredForRemoteMessages();
            
            if (!isReg) {
                await messaging().registerDeviceForRemoteMessages();
            }
            return true;
        } catch (e) {
            console.warn('[Push] iOS Registration Check Failed:', e);
            return false;
        }
    }

    static async initialize() {
        try {
            if (__DEV__) {
                console.log('═'.repeat(50));
                console.log('🔔 PUSH NOTIFICATION SERVICE - Initializing');
                console.log('═'.repeat(50));
            }

            // 1. Create Android Channels (Required for Notifee on Android 8.0+)
            if (Platform.OS === 'android') {
                await notifee.createChannel({
                    id: 'default',
                    name: 'Default Notifications',
                    importance: AndroidImportance.HIGH,
                });
                if (__DEV__) console.log('✅ Android notification channel created');
            }

            // 2. iOS Registration
            const isReady = await this.ensureIosRegistered();
            if (!isReady) {
                if (__DEV__) console.log('❌ iOS registration failed');
                return;
            }

            // 3. Permission Request
            const authStatus = await messaging().requestPermission();
            const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                           authStatus === messaging.AuthorizationStatus.PROVISIONAL;

            if (!enabled) {
                console.log('[Push] Permission denied - notifications will not work');
                if (__DEV__) console.log('═'.repeat(50));
                return;
            }

            if (__DEV__) console.log('✅ Notification permission granted');

            // 4. Token Logic
            try {
                const token = await messaging().getToken();
                console.log('[Push] FCM Token obtained:', token.substring(0, 30) + '...');
            } catch (tokenError) {
                console.log('[Push] Failed to get token (expected on simulator):', tokenError);
            }

            // 5. Token Refresh Listener
            messaging().onTokenRefresh(async (newToken) => {
                console.log('[Push] Token refreshed:', newToken.substring(0, 30) + '...');
            });

            // 6. Foreground Handler (Notifee Integration)
            messaging().onMessage(async (remoteMessage) => {
                console.log('[Push] Foreground message:', remoteMessage);
                
                await notifee.displayNotification({
                    title: remoteMessage.notification?.title,
                    body: remoteMessage.notification?.body,
                    data: remoteMessage.data,
                    android: {
                        channelId: 'default',
                        // High priority ensures heads-up notification
                        importance: AndroidImportance.HIGH,
                        pressAction: { id: 'default' },
                    },
                    ios: {
                        sound: 'default',
                    },
                });
            });

            // 7. Background -> Foreground (FCM native handler)
            // Note: Background handler is set at top level in index.js
            messaging().onNotificationOpenedApp((remoteMessage) => {
                console.log('[Push] Notification opened app:', remoteMessage);
                // Note: For Notifee-displayed notifications, use Notifee event listeners in _layout.tsx
            });

            // 8. Cold Start Handler
            messaging().getInitialNotification().then((remoteMessage) => {
                if (remoteMessage) {
                    console.log('[Push] App opened from quit state by notification:', remoteMessage);
                }
            });

            // 9. Topic Sync: Auto-subscribe to broadcast
            const offset = this.getTimezoneOffset();
            await messaging().subscribeToTopic(`broadcast_${offset}`);
            console.log(`[Push] Subscribed to broadcast topic: broadcast_${offset}`);

            if (__DEV__) {
                console.log('');
                console.log('📍 Timezone Information:');
                console.log(`   Offset: ${offset}`);
                console.log(`   Topics subscribed: broadcast_${offset}`);
                console.log('');
                console.log('💡 Topic subscription happens when:');
                console.log('   - Fasting notifications: Settings > Enable Fasting Reminders');
                console.log('   - Daily Ayah: Settings > Enable Daily Ayah');
                console.log('═'.repeat(50));
            }

            console.log('[Push] Initialization complete');
        } catch (error) {
            console.error('[Push] Initialization Error:', error);
        }
    }

    /**
     * Generic Topic Sync to reduce code duplication
     */
    private static async syncTopic(baseName: string, enabled: boolean) {
        const isReady = await this.ensureIosRegistered();
        if (!isReady) return;

        const offset = this.getTimezoneOffset();
        const topic = `${baseName}_${offset}`;

        try {
            if (enabled) {
                await messaging().subscribeToTopic(topic);
                await messaging().unsubscribeFromTopic(baseName); // Cleanup legacy
                console.log(`[Push] ✅ Subscribed to: ${topic}`);
                console.log(`[Push] Expected notification time: 5:00 AM (UTC${offset[0] === '-' ? offset : '+' + offset})`);
            } else {
                await messaging().unsubscribeFromTopic(topic);
                console.log(`[Push] ❌ Unsubscribed from: ${topic}`);
            }
        } catch (e) {
            console.error(`[Push] Topic Sync Error (${topic}):`, e);
        }
    }

    static async syncFastingSubscription(enabled: boolean) {
        await this.syncTopic('fasting', enabled);
    }

    static async syncAyahSubscription(enabled: boolean) {
        await this.syncTopic('daily_ayah', enabled);
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
