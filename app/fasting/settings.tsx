import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FastingCalendarContext } from '../../components/fasting/context/FastingCalendarContext';
import { useUnifiedTheme } from '../../hooks/useUnifiedTheme';
import * as Notifications from 'expo-notifications';

const FastingSettings: React.FC = () => {
  const { theme } = useUnifiedTheme();
  const fastingContext = useContext(FastingCalendarContext);
  const [isLocationLoading, setIsLocationLoading] = useState(false);

  if (!fastingContext) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Fasting Calendar Settings
          </Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.error }]}>
            FastingCalendar context not available
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { state, updateSettings } = fastingContext;
  const { settings } = state;

  const handleNotificationToggle = async (value: boolean) => {
    if (value) {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Please enable notifications in your device settings to receive fasting reminders.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => {
                // User needs to manually go to Settings
                Alert.alert('Settings', 'Please go to Settings > Notifications to enable notifications for this app.');
              }},
            ]
          );
          return;
        }
      } catch (error) {
        console.error('Error requesting notification permissions:', error);
        return;
      }
    }
    
    await updateSettings({
      notifications: {
        ...settings.notifications,
        enabled: value,
      }
    });
  };

  const handleLocationUpdate = async () => {
    setIsLocationLoading(true);
    try {
      // Simple location update - in a real app you might use expo-location
      Alert.prompt(
        'Update Location',
        'Enter your city:',
        async (city) => {
          if (city) {
            await updateSettings({
              location: {
                ...settings.location,
                city: city,
              }
            });
            Alert.alert('Success', `Location updated to ${city}`);
          }
        },
        'plain-text',
        settings.location.city || ''
      );
    } catch (error) {
      console.error('Error updating location:', error);
      Alert.alert('Error', 'Failed to update location.');
    } finally {
      setIsLocationLoading(false);
    }
  };

  const formatTime = (timeString: string) => {
    // Handle both HH:MM format and time objects
    if (typeof timeString === 'string') {
      const [hours, minutes] = timeString.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const displayMinutes = minutes.toString().padStart(2, '0');
      return `${displayHours}:${displayMinutes} ${period}`;
    }
    return timeString;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Fasting Calendar Settings
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Notifications Section */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Notifications</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>
                Enable Notifications
              </Text>
              <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                Receive reminders for Sahur and Iftar times
              </Text>
            </View>
            <Switch
              value={settings.notifications.enabled}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={settings.notifications.enabled ? theme.background : theme.textSecondary}
            />
          </View>

          {settings.notifications.enabled && (
            <>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>
                    Sahur Reminder
                  </Text>
                  <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                    Remind me before Fajr prayer time
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.timeButton, { borderColor: theme.border }]}
                  onPress={() => {
                    // TODO: Implement time picker modal
                    Alert.alert('Time Picker', 'Time picker will be implemented soon');
                  }}
                >
                  <Text style={[styles.timeText, { color: theme.primary }]}>
                    {formatTime(settings.notifications.defaultTime)}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>
                    Iftar Reminder
                  </Text>
                  <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                    Remind me at Maghrib prayer time
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.timeButton, { borderColor: theme.border }]}
                  onPress={() => {
                    // TODO: Implement time picker modal
                    Alert.alert('Time Picker', 'Time picker will be implemented soon');
                  }}
                >
                  <Text style={[styles.timeText, { color: theme.primary }]}>
                    {formatTime(settings.notifications.defaultTime)}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Location Section */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Location</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>
                Current Location
              </Text>
              <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                {settings.location.city && settings.location.country 
                  ? `${settings.location.city}, ${settings.location.country}`
                  : 'Location not set'
                }
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              onPress={handleLocationUpdate}
              disabled={isLocationLoading}
            >
              {isLocationLoading ? (
                <Text style={[styles.actionButtonText, { color: theme.background }]}>
                  Updating...
                </Text>
              ) : (
                <Text style={[styles.actionButtonText, { color: theme.background }]}>
                  Update
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Calendar Settings Section */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Calendar Settings</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>
                Hijri Calendar System
              </Text>
              <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                Follow Islamic lunar calendar for accurate dates
              </Text>
            </View>
            <Text style={[styles.statusText, { color: theme.success }]}>
              Active
            </Text>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>
                Prayer Time Calculation
              </Text>
              <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                Accurate prayer times based on your location
              </Text>
            </View>
            <Text style={[styles.statusText, { color: theme.success }]}>
              Enabled
            </Text>
          </View>
        </View>

        {/* Theme Integration Section */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Theme Integration</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>
                Sync with iHafidh Theme
              </Text>
              <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                FastingCalendar follows your main app theme settings
              </Text>
            </View>
            <Text style={[styles.statusText, { color: theme.success }]}>
              Synced
            </Text>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  timeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  bottomSpacing: {
    height: 32,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
});

export default FastingSettings;
