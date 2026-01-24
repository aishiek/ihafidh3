import notifee from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import { registerRootComponent } from 'expo';

import App from './App';

// Background message handler - MUST be at top level
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('[Background] Message received:', remoteMessage);
  
  // Display notification using Notifee
  await notifee.displayNotification({
    title: remoteMessage.notification?.title,
    body: remoteMessage.notification?.body,
    data: remoteMessage.data,
    android: {
      channelId: 'default',
      importance: 4, // HIGH
    },
  });
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
