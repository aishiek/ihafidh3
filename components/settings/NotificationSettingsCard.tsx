import { useSettingsStore } from '@/store/settingsStore';
import { useCustomColors } from '@/utils/themeUtils';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

export default function NotificationSettingsCard() {
  const colors = useCustomColors();
  const { 
    notificationSettings, 
    setNotificationSetting,
    revisionReminderSettings,
    setRevisionReminderSettings
  } = useSettingsStore();

  const notificationOptions = [
    {
      key: 'dailyAyah',
      title: 'Daily Ayah Notification',
      description: 'Receive a verse from the Quran each day',
      icon: '📖'
    },
    {
      key: 'dailyVerseReminder',
      title: 'Daily Verse Target',
      description: 'Reminder if daily memorization goal not met',
      icon: '🎯'
    },
    {
      key: 'weeklySurahsReminder',
      title: 'Weekly Surahs',
      description: 'Reminder for incomplete weekly Surah goals',
      icon: '📅'
    },
    {
      key: 'hifdhPlannerReminder',
      title: 'Hifdh Planner',
      description: 'Alerts for overdue memorization tasks',
      icon: '⏰'
    }
  ] as const;

  // Local input state lets the user edit freely (including clearing while typing),
  // then we validate & persist on blur/submit.
  const [daysInput, setDaysInput] = React.useState(
    revisionReminderSettings.daysThreshold.toString()
  );

  React.useEffect(() => {
    setDaysInput(revisionReminderSettings.daysThreshold.toString());
  }, [revisionReminderSettings.daysThreshold]);

  const commitDaysInput = (text?: string) => {
    const value = text ?? daysInput;
    const parsed = parseInt(value, 10);
    const defaultDays = 3;
    const clamped = Number.isNaN(parsed) ? defaultDays : Math.min(30, Math.max(1, parsed));
    setRevisionReminderSettings({ ...revisionReminderSettings, daysThreshold: clamped });
    setDaysInput(clamped.toString());
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        🔔 Notifications
      </Text>
      
      {notificationOptions.map((option) => (
        <Pressable 
          key={option.key} 
          style={styles.settingRow}
          onPress={() => setNotificationSetting(option.key, !(notificationSettings?.[option.key] ?? false))}
        >
          <View style={styles.settingLeft}>
            <Text style={styles.icon}>{option.icon}</Text>
            <View style={styles.textContainer}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                {option.title}
              </Text>
              <Text style={[styles.settingDescription, { color: colors.text, opacity: 0.7 }]}>
                {option.description}
              </Text>
            </View>
          </View>
          <Switch
            value={notificationSettings?.[option.key] ?? false}
            onValueChange={(value) => setNotificationSetting(option.key, value)}
            trackColor={{ false: '#767577', true: colors.primary }}
            thumbColor={notificationSettings?.[option.key] ? '#fff' : '#f4f3f4'}
          />
        </Pressable>
      ))}

      {/* Revision Reminder - Separate Section */}
      <View style={[styles.separator, { backgroundColor: colors.text, opacity: 0.1 }]} />
      
      <Pressable 
        style={styles.settingRow}
        onPress={() => setRevisionReminderSettings({ 
          ...revisionReminderSettings, 
          enabled: !revisionReminderSettings.enabled 
        })}
      >
        <View style={styles.settingLeft}>
          <Text style={styles.icon}>🔄</Text>
          <View style={styles.textContainer}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>
              Surah Revision Reminder (Daily 9 PM)
            </Text>
            <Text style={[styles.settingDescription, { color: colors.text, opacity: 0.7 }]}>
              Daily check at 9 PM for fully memorized surahs not revised in X days
            </Text>
          </View>
        </View>
        <Switch
          value={revisionReminderSettings.enabled}
          onValueChange={(enabled) => setRevisionReminderSettings({ 
            ...revisionReminderSettings, 
            enabled 
          })}
          trackColor={{ false: '#767577', true: colors.primary }}
          thumbColor={revisionReminderSettings.enabled ? '#fff' : '#f4f3f4'}
        />
      </Pressable>

      {/* Days Threshold Input - Shows when enabled */}
      {revisionReminderSettings.enabled && (
        <View style={styles.subSettingRow}>
          <Text style={[styles.subSettingLabel, { color: colors.text, opacity: 0.9 }]}>
            Days before reminder:
          </Text>
          <View style={styles.daysInputContainer}>
            <TextInput
              style={[styles.daysInput, { 
                color: colors.text, 
                backgroundColor: colors.background,
                borderColor: colors.text
              }]}
                value={daysInput}
                onChangeText={(text) => {
                  // Allow user to type freely (including empty string) — handle persist on blur/submit
                  // Keep only digits to avoid non-numeric input.
                  const digitsOnly = text.replace(/[^0-9]/g, '');
                  setDaysInput(digitsOnly);
                }}
                onBlur={() => commitDaysInput()}
                onSubmitEditing={() => commitDaysInput()}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={[styles.daysLabel, { color: colors.text, opacity: 0.7 }]}>
              days
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#555555',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    opacity: 0.8,
  },
  separator: {
    height: 1,
    marginVertical: 12,
  },
  subSettingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  subSettingLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  daysInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  daysInput: {
    width: 50,
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  daysLabel: {
    fontSize: 14,
  },
});
