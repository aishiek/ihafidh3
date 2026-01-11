import notifee from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import { registerRootComponent } from 'expo';

import App from './App';

// CRITICAL: Background message handler MUST be set at top level
// This is required by React Native Firebase for background/quit state notifications
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('[Push:Background] Message received:', remoteMessage);
    
    // For Android: Display notification when app is in background/quit
    // FCM already shows it, but we can add custom handling if needed
    if (remoteMessage.notification) {
        await notifee.displayNotification({
            title: remoteMessage.notification.title,
            body: remoteMessage.notification.body,
            data: remoteMessage.data,
            android: {
                channelId: 'default',
                pressAction: { id: 'default' },
            },
        });
    }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
