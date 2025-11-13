import {
    AyahNotificationService,
    cancelAllNotifications,
    FastingNotificationService,
    getScheduledNotifications,
    RevisionNotificationService,
    sendTestNotification
} from '@/services/NotificationService';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function NotificationDebugScreen() {
  const [scheduled, setScheduled] = useState<Notifications.NotificationRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const loadScheduled = async () => {
    setLoading(true);
    const notifications = await getScheduledNotifications();
    setScheduled(notifications);
    setLoading(false);
  };

  useEffect(() => {
    loadScheduled();
  }, []);

  const handleSendTest = async () => {
    await sendTestNotification();
    Alert.alert('Success', 'Test notification sent!');
  };

  const handleCancelAll = async () => {
    await cancelAllNotifications();
    Alert.alert('Success', 'All notifications cancelled');
    loadScheduled();
  };

  const handleScheduleDailyAyah = async () => {
    await AyahNotificationService.scheduleDailyReminder('09:00');
    Alert.alert('Success', 'Daily Ayah scheduled for 9:00 AM');
    loadScheduled();
  };

  const handleScheduleDailyRevision = async () => {
    await RevisionNotificationService.scheduleDailyReminder(true);
    Alert.alert('Success', 'Daily revision reminder scheduled');
    loadScheduled();
  };

  const handleScheduleFasting = async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    
    await FastingNotificationService.scheduleReminder({
      fastingType: 'TEST',
      fastingName: 'Test Fasting',
      fastingDescription: 'This is a test',
      date: dateStr,
      beforeDays: 0,
      time: '09:00',
    });
    Alert.alert('Success', 'Fasting reminder scheduled for tomorrow');
    loadScheduled();
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Notification Debug</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Actions</Text>
        
        <TouchableOpacity style={styles.button} onPress={handleSendTest}>
          <Text style={styles.buttonText}>🧪 Send Test Notification</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleScheduleDailyAyah}>
          <Text style={styles.buttonText}>📖 Schedule Daily Ayah (9 AM)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleScheduleDailyRevision}>
          <Text style={styles.buttonText}>📚 Schedule Daily Revision</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleScheduleFasting}>
          <Text style={styles.buttonText}>🌙 Schedule Test Fasting</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.dangerButton]} 
          onPress={handleCancelAll}
        >
          <Text style={styles.buttonText}>❌ Cancel All Notifications</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.refreshButton]} 
          onPress={loadScheduled}
        >
          <Text style={styles.buttonText}>🔄 Refresh List</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Scheduled Notifications ({scheduled.length})
        </Text>
        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : scheduled.length === 0 ? (
          <Text style={styles.emptyText}>No scheduled notifications</Text>
        ) : (
          scheduled.map((notification, index) => (
            <View key={index} style={styles.notificationCard}>
              <Text style={styles.notificationId}>
                ID: {notification.identifier}
              </Text>
              <Text style={styles.notificationTitle}>
                {notification.content.title}
              </Text>
              <Text style={styles.notificationBody}>
                {notification.content.body}
              </Text>
              <Text style={styles.notificationTrigger}>
                Trigger: {JSON.stringify(notification.trigger, null, 2)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 24,
    marginTop: 40,
    textAlign: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#4a90e2',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  dangerButton: {
    backgroundColor: '#e24a4a',
  },
  refreshButton: {
    backgroundColor: '#50c878',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  notificationCard: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
  },
  notificationId: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  notificationTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationBody: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
  },
  notificationTrigger: {
    color: '#888',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
