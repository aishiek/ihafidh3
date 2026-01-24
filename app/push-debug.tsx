import React, { useEffect, useState } from 'react';
import { Alert, Clipboard, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PushNotificationService } from '../services/PushNotificationService';
import { useSettingsStore } from '../store/settingsStore';

export default function PushDebugScreen() {
  const [token, setToken] = useState<string>('Loading...');
  const [apnsToken, setApnsToken] = useState<string>('Loading...');
  const [authStatus, setAuthStatus] = useState<string>('Loading...');
  const [timezone, setTimezone] = useState<string>('');
  const [testResult, setTestResult] = useState<string>('');
  
  const notificationsEnabled = useSettingsStore(s => s.notificationsEnabled);
  const notificationSettings = useSettingsStore(s => s.notificationSettings);
  const ayahEnabled = notificationSettings?.dailyAyah ?? false;

  useEffect(() => {
    loadInfo();
  }, []);

  const loadInfo = async () => {
    // Register for remote messages (iOS only)
    if (Platform.OS === 'ios') {
      try {
        const messagingModule = await import('@react-native-firebase/messaging');
        await messagingModule.default().registerDeviceForRemoteMessages();
        // Get APNs Token
        const apnsTokenValue = await messagingModule.default().getAPNSToken();
        setApnsToken(apnsTokenValue ? apnsTokenValue : 'No APNs token');
      } catch (e) {
        setApnsToken('Error: ' + (e?.message || e));
      }
    } else {
      setApnsToken('N/A (Android)');
    }

    // Get FCM Token (store full token)
    const fcmToken = await PushNotificationService.getToken();
    setToken(fcmToken || 'No token');

    // Get permission status
    const isEnabled = await PushNotificationService.isEnabled();
    setAuthStatus(isEnabled ? '✅ GRANTED' : '❌ DENIED');

    // Get timezone
    const tz = PushNotificationService.getTimezoneOffset();
    setTimezone(tz);
  };

  const requestPermission = async () => {
    try {
      setTestResult('Requesting permission...');
      
      // Initialize Firebase first to avoid "app not initialized" error
      await PushNotificationService.initialize();
      
      // Then reload status
      await loadInfo();
      setTestResult('✅ Initialized! Check status above.');
    } catch (e: any) {
      setTestResult('❌ Error: ' + e.message);
      console.error('[Debug] Request permission error:', e);
    }
  };

  const resubscribe = async () => {
    try {
      setTestResult('🔄 Re-subscribing to all topics...');
      
      // Use the new dedicated re-subscribe method
      await PushNotificationService.forceResubscribeAll(notificationsEnabled, ayahEnabled);
      
      await loadInfo(); // Refresh token/status
      setTestResult('✅ Successfully subscribed to all topics for timezone ' + timezone);
      Alert.alert('Success', `Subscribed to all topics!\n\nbroadcast_${timezone}\nfasting_${timezone}\ndaily_ayah_${timezone}\n\nYou should now receive notifications.`);
    } catch (e: any) {
      const errorMsg = e.message || 'Unknown error';
      setTestResult('❌ Error: ' + errorMsg);
      Alert.alert('Subscription Failed', errorMsg);
      console.error('[Debug] Resubscribe error:', e);
    }
  };

  const copyToken = (tokenValue: string, tokenName: string) => {
    if (tokenValue && !tokenValue.includes('No token') && !tokenValue.includes('Loading') && !tokenValue.includes('N/A')) {
      Clipboard.setString(tokenValue);
      Alert.alert('Copied!', `${tokenName} copied to clipboard`);
    } else {
      Alert.alert('Error', 'No valid token to copy');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>📱 Push Notification Debug</Text>
      
      <View style={styles.section}>
        <Text style={styles.label}>Permission Status:</Text>
        <Text style={styles.value}>{authStatus}</Text>
        {authStatus.includes('DENIED') && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>⚠️ Notifications are blocked!</Text>
            <Text style={styles.warningSubtext}>
              You need to enable notification permissions for this app.
            </Text>
            <TouchableOpacity 
              style={[styles.button, styles.permissionButton]} 
              onPress={requestPermission}
            >
              <Text style={styles.buttonText}>📱 Request Permission</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>FCM Token:</Text>
        <Text style={styles.valueSmall} numberOfLines={3}>{token}</Text>
        <TouchableOpacity 
          style={styles.copyButton} 
          onPress={() => copyToken(token, 'FCM Token')}
        >
          <Text style={styles.copyButtonText}>📋 Copy FCM Token</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>If "No token", FCM is not working</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>APNs Token (iOS only):</Text>
        <Text style={styles.valueSmall}>{apnsToken}</Text>
        <Text style={styles.hint}>If "No APNs token", iOS push will NOT work</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Your Timezone:</Text>
        <Text style={styles.value}>{timezone || 'Unknown'}</Text>
        <Text style={styles.hint}>Notifications target: UTC{timezone[0] === '-' ? timezone : '+' + timezone}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Topics You Should Be Subscribed To:</Text>
        <Text style={styles.topic}>• broadcast_{timezone} (Always)</Text>
        {notificationsEnabled && (
          <Text style={styles.topic}>• fasting_{timezone} (Daily Reminders ON)</Text>
        )}
        {ayahEnabled && (
          <Text style={styles.topic}>• daily_ayah_{timezone} (Daily Ayah ON)</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Settings:</Text>
        <Text style={styles.value}>Daily Reminders: {notificationsEnabled ? '✅ ON' : '❌ OFF'}</Text>
        <Text style={styles.value}>Daily Ayah: {ayahEnabled ? '✅ ON' : '❌ OFF'}</Text>
      </View>

      {authStatus.includes('DENIED') && (
        <TouchableOpacity style={[styles.button, styles.permissionButton]} onPress={requestPermission}>
          <Text style={styles.buttonText}>📱 Request Permission</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.button} onPress={resubscribe}>
        <Text style={styles.buttonText}>🔄 Re-subscribe Now</Text>
      </TouchableOpacity>

      {testResult !== '' && (
        <View style={styles.result}>
          <Text style={styles.resultText}>{testResult}</Text>
        </View>
      )}

      <View style={styles.instructions}>
        <Text style={styles.instructionTitle}>📋 How to Test:</Text>
        <Text style={styles.instruction}>1. Tap "Re-subscribe Now" button above</Text>
        <Text style={styles.instruction}>2. Go to GitHub Actions</Text>
        <Text style={styles.instruction}>3. Run "Send Custom Broadcast"</Text>
        <Text style={styles.instruction}>4. You should receive notification in 10 seconds</Text>
        <Text style={styles.instruction}>5. If not received, FCM Token issue or Google Play Services problem</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#2a2a2a',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginBottom: 5,
    fontWeight: '600',
  },
  value: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 5,
  },
  valueSmall: {
    fontSize: 12,
    color: '#fff',
    fontFamily: 'monospace',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    fontStyle: 'italic',
  },
  topic: {
    fontSize: 14,
    color: '#4CAF50',
    marginVertical: 3,
    fontFamily: 'monospace',
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  warningText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 4,
  },
  warningSubtext: {
    fontSize: 14,
    color: '#856404',
  },
  permissionButton: {
    backgroundColor: '#ff9800',
  },
  copyButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 10,
    marginVertical: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  result: {
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  resultText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  instructions: {
    backgroundColor: '#2a2a2a',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  instructionTitle: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  instruction: {
    fontSize: 13,
    color: '#aaa',
    marginVertical: 3,
    paddingLeft: 5,
  },
});
