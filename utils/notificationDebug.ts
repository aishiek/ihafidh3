/**
 * Notification Debugging Utilities
 * 
 * Helper functions to diagnose push notification issues
 */

import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

export interface NotificationDebugInfo {
    hasPermission: boolean;
    authStatus: string;
    fcmToken: string | null;
    timezone: string;
    expectedTopics: string[];
    platform: string;
}

/**
 * Get comprehensive debug information about push notification status
 */
export async function getNotificationDebugInfo(): Promise<NotificationDebugInfo> {
    const debugInfo: NotificationDebugInfo = {
        hasPermission: false,
        authStatus: 'unknown',
        fcmToken: null,
        timezone: '',
        expectedTopics: [],
        platform: Platform.OS
    };

    try {
        // Check authorization status
        const authStatus = await messaging().hasPermission();
        debugInfo.hasPermission = authStatus === messaging.AuthorizationStatus.AUTHORIZED;
        debugInfo.authStatus = getAuthStatusString(authStatus);

        // Get FCM token
        try {
            const token = await messaging().getToken();
            debugInfo.fcmToken = token;
        } catch (e) {
            console.error('[Debug] Failed to get FCM token:', e);
        }

        // Get timezone offset
        const offset = new Date().getTimezoneOffset();
        const hours = Math.abs(Math.floor(offset / 60));
        const sign = offset <= 0 ? '+' : '-';
        const paddedHours = hours.toString().padStart(2, '0');
        debugInfo.timezone = `${sign}${paddedHours}00`;

        // Calculate expected topics based on timezone
        debugInfo.expectedTopics = [
            `broadcast_${debugInfo.timezone}`,
            `fasting_${debugInfo.timezone}`,
            `daily_ayah_${debugInfo.timezone}`
        ];

    } catch (e) {
        console.error('[Debug] Error gathering notification info:', e);
    }

    return debugInfo;
}

/**
 * Convert authorization status to readable string
 */
function getAuthStatusString(status: number): string {
    switch (status) {
        case messaging.AuthorizationStatus.AUTHORIZED:
            return 'Authorized';
        case messaging.AuthorizationStatus.DENIED:
            return 'Denied';
        case messaging.AuthorizationStatus.NOT_DETERMINED:
            return 'Not Determined';
        case messaging.AuthorizationStatus.PROVISIONAL:
            return 'Provisional';
        default:
            return 'Unknown';
    }
}

/**
 * Format debug info for display
 */
export function formatDebugInfo(info: NotificationDebugInfo): string {
    const lines = [
        '═════════════════════════════════════',
        '🔔 PUSH NOTIFICATION DEBUG INFO',
        '═════════════════════════════════════',
        '',
        `Platform: ${info.platform.toUpperCase()}`,
        `Permission: ${info.hasPermission ? '✅ Granted' : '❌ Denied'}`,
        `Auth Status: ${info.authStatus}`,
        `Timezone: ${info.timezone}`,
        '',
        'FCM Token:',
        info.fcmToken ? `${info.fcmToken.substring(0, 40)}...` : '❌ No token',
        '',
        'Expected Topic Subscriptions:',
        ...info.expectedTopics.map(t => `  • ${t}`),
        '',
        '═════════════════════════════════════',
        '',
        '💡 Troubleshooting Steps:',
        '',
        '1. Verify permissions:',
        `   ${Platform.OS === 'ios' ? 'Settings > Notifications > iHafidh' : 'Settings > Apps > iHafidh > Notifications'}`,
        '',
        '2. Check in-app settings:',
        '   • Enable Fasting Reminders',
        '   • Enable Daily Ayah',
        '',
        '3. Expected notification time:',
        `   • 5:00 AM in your timezone (UTC${info.timezone})`,
        '',
        '4. If still not working:',
        '   • Try toggling notifications off/on in Settings',
        '   • Restart the app',
        '   • Check Do Not Disturb mode',
        Platform.OS === 'android' ? '   • Check Battery Optimization settings' : ''
    ].filter(Boolean);

    return lines.join('\n');
}

/**
 * Log comprehensive debug info to console
 */
export async function logNotificationDebugInfo(): Promise<void> {
    console.log('\n');
    const info = await getNotificationDebugInfo();
    console.log(formatDebugInfo(info));
    console.log('\n');
}

/**
 * Test notification subscription by attempting to subscribe/unsubscribe
 */
export async function testTopicSubscription(topic: string): Promise<boolean> {
    try {
        console.log(`[Debug] Testing subscription to: ${topic}`);
        
        // Try to subscribe
        await messaging().subscribeToTopic(topic);
        console.log(`[Debug] ✅ Successfully subscribed to: ${topic}`);
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try to unsubscribe
        await messaging().unsubscribeFromTopic(topic);
        console.log(`[Debug] ✅ Successfully unsubscribed from: ${topic}`);
        
        // Re-subscribe
        await messaging().subscribeToTopic(topic);
        console.log(`[Debug] ✅ Re-subscribed to: ${topic}`);
        
        return true;
    } catch (e) {
        console.error(`[Debug] ❌ Failed to test subscription for ${topic}:`, e);
        return false;
    }
}

/**
 * Re-initialize all topic subscriptions
 */
export async function reinitializeSubscriptions(
    fastingEnabled: boolean,
    ayahEnabled: boolean
): Promise<void> {
    console.log('\n[Debug] 🔄 Re-initializing topic subscriptions...');
    
    const offset = new Date().getTimezoneOffset();
    const hours = Math.abs(Math.floor(offset / 60));
    const sign = offset <= 0 ? '+' : '-';
    const paddedHours = hours.toString().padStart(2, '0');
    const timezone = `${sign}${paddedHours}00`;
    
    console.log(`[Debug] Timezone: ${timezone}`);
    console.log(`[Debug] Fasting enabled: ${fastingEnabled}`);
    console.log(`[Debug] Daily Ayah enabled: ${ayahEnabled}`);
    
    try {
        // Always subscribe to broadcast
        const broadcastTopic = `broadcast_${timezone}`;
        await messaging().subscribeToTopic(broadcastTopic);
        console.log(`[Debug] ✅ Subscribed to: ${broadcastTopic}`);
        
        // Fasting topic
        const fastingTopic = `fasting_${timezone}`;
        if (fastingEnabled) {
            await messaging().subscribeToTopic(fastingTopic);
            console.log(`[Debug] ✅ Subscribed to: ${fastingTopic}`);
        } else {
            await messaging().unsubscribeFromTopic(fastingTopic);
            console.log(`[Debug] ❌ Unsubscribed from: ${fastingTopic}`);
        }
        
        // Daily Ayah topic
        const ayahTopic = `daily_ayah_${timezone}`;
        if (ayahEnabled) {
            await messaging().subscribeToTopic(ayahTopic);
            console.log(`[Debug] ✅ Subscribed to: ${ayahTopic}`);
        } else {
            await messaging().unsubscribeFromTopic(ayahTopic);
            console.log(`[Debug] ❌ Unsubscribed from: ${ayahTopic}`);
        }
        
        console.log('[Debug] ✅ All subscriptions updated successfully');
        
    } catch (e) {
        console.error('[Debug] ❌ Error reinitializing subscriptions:', e);
    }
    
    console.log('\n');
}
