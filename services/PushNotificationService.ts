import notifee, { AndroidImportance } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';

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
            const ms = messaging();

            // Some RNFB versions may not expose isDeviceRegisteredForRemoteMessages()
            const hasIsRegistered = typeof ms.isDeviceRegisteredForRemoteMessages === 'function';
            let isReg = false;

            if (hasIsRegistered) {
                try {
                    isReg = await ms.isDeviceRegisteredForRemoteMessages();
                } catch (e) {
                    console.warn('[Push] isDeviceRegisteredForRemoteMessages threw:', e);
                    isReg = false;
                }
            }

            if (!isReg) {
                try {
                    await ms.registerDeviceForRemoteMessages();
                    // give native a moment
                    return true;
                } catch (regErr) {
                    console.warn('[Push] registerDeviceForRemoteMessages failed:', regErr);
                    return false;
                }
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

            // 3. Permission Request (Platform-specific)
            let enabled = false;
            
            if (Platform.OS === 'android') {
                // Android 13+ requires POST_NOTIFICATIONS runtime permission
                if (Platform.Version >= 33) {
                    const granted = await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
                    );
                    enabled = granted === PermissionsAndroid.RESULTS.GRANTED;
                    console.log('[Push] Android 13+ permission:', granted);
                } else {
                    // Android 12 and below - notifications enabled by default
                    enabled = true;
                    console.log('[Push] Android <13 - notifications enabled by default');
                }
            } else {
                // iOS
                const authStatus = await messaging().requestPermission();
                enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                         authStatus === messaging.AuthorizationStatus.PROVISIONAL;
            }

            if (!enabled) {
                console.log('[Push] Permission denied - notifications will not work');
                if (__DEV__) console.log('═'.repeat(50));
                return;
            }

            console.log('[Push] ✅ Notification permission granted');

            // 4. Token Logic
            if (Platform.OS === 'ios') {
                const apnsToken = await messaging().getAPNSToken();
                if (apnsToken) {
                    console.log('[Push] APNS Token linked:', apnsToken);
                } else {
                    console.error('[Push] Critical: No APNS Token. Check Xcode Capabilities.');
                }
            }
            try {
                const token = await messaging().getToken();
                console.log('[Push] FCM Token obtained:', token);
                // For easy copy-paste:
                console.log('==== COPY THIS FCM TOKEN FOR TESTING ====');
                console.log(token);
                console.log('==========================================');
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
            console.log(`[Push] Attempting to subscribe to: broadcast_${offset}`);
            try {
                // On iOS, add delay to ensure APNs token is registered
                if (Platform.OS === 'ios') {
                    const apnsToken = await messaging().getAPNSToken();
                    if (!apnsToken) {
                        console.warn('[Push] Warning: No APNs token yet, subscription may fail');
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } else {
                        console.log('[Push] APNs token confirmed before topic subscription');
                    }
                }
                
                await messaging().subscribeToTopic(`broadcast_${offset}`);
                console.log(`[Push] ✅ Subscribed to broadcast: broadcast_${offset}`);
                console.log(`[Push] 📍 Your timezone: UTC${offset[0] === '-' ? offset : '+' + offset}`);
            } catch (broadcastErr) {
                console.error(`[Push] ❌ Failed to subscribe to broadcast_${offset}:`, broadcastErr);
                // Retry once after a delay
                try {
                    console.log('[Push] Retrying broadcast subscription in 2s...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    await messaging().subscribeToTopic(`broadcast_${offset}`);
                    console.log(`[Push] ✅ Retry succeeded: broadcast_${offset}`);
                } catch (retryErr) {
                    console.error('[Push] ❌ Retry failed:', retryErr);
                }
            }

            console.log('[Push] ✅ Initialization complete');
        } catch (error) {
            console.error('[Push] Initialization Error:', error);
        }
    }

    /**
     * Generic Topic Sync to reduce code duplication
     */
    private static async syncTopic(baseName: string, enabled: boolean) {
        const isReady = await this.ensureIosRegistered();
        if (!isReady) {
            console.warn(`[Push] iOS not ready, skipping ${baseName} sync`);
            return;
        }

        const offset = this.getTimezoneOffset();
        const topic = `${baseName}_${offset}`;

        try {
            if (enabled) {
                // On iOS, add a small delay to ensure APNs token is ready
                if (Platform.OS === 'ios') {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
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
            throw e; // Re-throw to propagate error
        }
    }

    static async syncFastingSubscription(enabled: boolean) {
        await this.syncTopic('fasting', enabled);
    }

    static async syncAyahSubscription(enabled: boolean) {
        await this.syncTopic('daily_ayah', enabled);
    }

    /**
     * Force re-subscribe to all topics (for debugging/manual refresh)
     */
    static async forceResubscribeAll(fastingEnabled: boolean, ayahEnabled: boolean): Promise<void> {
        const isReady = await this.ensureIosRegistered();
        if (!isReady) {
            throw new Error('iOS device not ready for remote notifications');
        }

        const offset = this.getTimezoneOffset();
        
        // Verify APNs token on iOS
        if (Platform.OS === 'ios') {
            const apnsToken = await messaging().getAPNSToken();
            if (!apnsToken) {
                throw new Error('No APNs token available. Cannot subscribe to topics.');
            }
            console.log('[Push] APNs token verified:', apnsToken.substring(0, 20) + '...');
        }

        // Wait a moment for iOS to be fully ready
        if (Platform.OS === 'ios') {
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const results: string[] = [];
        
        // Subscribe to broadcast (always)
        try {
            await messaging().subscribeToTopic(`broadcast_${offset}`);
            results.push(`✅ broadcast_${offset}`);
            console.log(`[Push] ✅ Subscribed to: broadcast_${offset}`);
        } catch (e: any) {
            results.push(`❌ broadcast_${offset}: ${e.message}`);
            throw new Error(`Failed to subscribe to broadcast: ${e.message}`);
        }

        // Subscribe to fasting if enabled
        if (fastingEnabled) {
            try {
                await messaging().subscribeToTopic(`fasting_${offset}`);
                results.push(`✅ fasting_${offset}`);
                console.log(`[Push] ✅ Subscribed to: fasting_${offset}`);
            } catch (e: any) {
                results.push(`❌ fasting_${offset}: ${e.message}`);
            }
        }

        // Subscribe to daily_ayah if enabled
        if (ayahEnabled) {
            try {
                await messaging().subscribeToTopic(`daily_ayah_${offset}`);
                results.push(`✅ daily_ayah_${offset}`);
                console.log(`[Push] ✅ Subscribed to: daily_ayah_${offset}`);
            } catch (e: any) {
                results.push(`❌ daily_ayah_${offset}: ${e.message}`);
            }
        }

        console.log('[Push] Re-subscribe results:', results);
    }

    /**
     * Get the current FCM token
     */
    static async getToken(): Promise<string | null> {
        try {
            // Ensure iOS is registered for remote messages before retrieving token
            const isReady = await this.ensureIosRegistered();
            if (!isReady) {
                console.error('[Push] Cannot get token: device not registered for remote messages');
                return null;
            }

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
            if (Platform.OS === 'android') {
                // Android 13+ check
                if (Platform.Version >= 33) {
                    const result = await PermissionsAndroid.check(
                        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
                    );
                    return result;
                }
                // Android 12 and below - always enabled
                return true;
            } else {
                // iOS
                const authStatus = await messaging().hasPermission();
                return (
                    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                    authStatus === messaging.AuthorizationStatus.PROVISIONAL
                );
            }
        } catch (error) {
            console.error('[Push] Failed to check permission:', error);
            return false;
        }
    }
}
