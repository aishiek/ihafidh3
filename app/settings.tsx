import { BackfillButton } from '@/components/BackfillButton';
import { useSettingsStore } from '@/store/settingsStore';
import { useCustomColors } from '@/utils/themeUtils';
import { router, Stack } from 'expo-router';
import {
    ArrowLeft,
    Bell,
    Check,
    Moon,
    Palette,
    RotateCcw,
    Sun,
    Target,
    User,
    Volume2
} from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useActivityStore } from '../store/activityStore';
import { ColorScheme, useThemeStore } from '../store/themeStore';

export default function SettingsScreen() {
  const colors = useCustomColors();
  const { 
    userName, 
    setUserName, 
    showTranslation, 
    setShowTranslation,
    autoPlayAudio, 
    setAutoPlayAudio,
    notificationsEnabled, 
    setNotificationsEnabled,
    repeatMode,
    setRepeatMode,
    reminderTime,
    setReminderTime
  } = useSettingsStore();
  
  const { themeMode, colorScheme, setThemeMode, setColorScheme } = useThemeStore();
  const { 
    dailyRevisionTarget, 
    weeklyRevisionTarget, 
    setDailyRevisionTarget, 
    setWeeklyRevisionTarget 
  } = useActivityStore();
  
  const [localName, setLocalName] = useState(userName);
  
  const handleNameChange = (text: string) => {
    setLocalName(text);
    setUserName(text);
  };
  
  

  const handleBack = () => {
    router.back();
  };

  const colorSchemes: { value: ColorScheme; label: string; color: string }[] = [
    { value: 'blue', label: 'Ocean Blue', color: '#2196F3' },
    { value: 'green', label: 'Forest Green', color: '#4CAF50' },
    { value: 'purple', label: 'Royal Purple', color: '#9C27B0' },
    { value: 'orange', label: 'Sunset Orange', color: '#FF9800' },
  ];

  const dailyTargets = [3, 5, 10, 15, 20];
  const weeklyTargets = [1, 2, 3, 5, 7];
  
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        title: 'Settings',
        headerStyle: {
          backgroundColor: '#000000',
        },
        headerTintColor: '#ffffff',
      }} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>
        
        {/* User Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Information</Text>
          
          <View style={styles.inputContainer}>
            <View style={styles.inputHeader}>
              <View style={styles.iconContainer}>
                <User size={20} color="#2196F3" />
              </View>
              <Text style={styles.inputLabel}>Name</Text>
            </View>
            <TextInput
              style={styles.input}
              value={localName}
              onChangeText={handleNameChange}
              placeholder="Enter your name"
              placeholderTextColor="#666666"
            />
          </View>
        </View>
        
        {/* Theme Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          
          {/* Theme Mode */}
          <View style={styles.settingItem}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.iconContainer}>
                  {themeMode === 'dark' ? (
                    <Moon size={20} color="#2196F3" />
                  ) : (
                    <Sun size={20} color="#FFD700" />
                  )}
                </View>
                <View>
                  <Text style={styles.settingLabel}>Dark Mode</Text>
                  <Text style={styles.settingDescription}>
                    {themeMode === 'dark' ? 'Dark theme enabled' : 'Light theme enabled'}
                  </Text>
                </View>
              </View>
              <Switch
                value={themeMode === 'dark'}
                onValueChange={(value) => setThemeMode(value ? 'dark' : 'light')}
                trackColor={{ false: '#444444', true: '#2196F380' }}
                thumbColor={themeMode === 'dark' ? '#2196F3' : '#888888'}
                ios_backgroundColor="#444444"
              />
            </View>
          </View>

          {/* Color Scheme */}
          <View style={styles.settingItem}>
            <View style={styles.settingHeader}>
              <View style={styles.iconContainer}>
                <Palette size={20} color="#2196F3" />
              </View>
              <View>
                <Text style={styles.settingLabel}>Color Theme</Text>
                <Text style={styles.settingDescription}>Choose your preferred color scheme</Text>
              </View>
            </View>
            <View style={styles.colorGrid}>
              {colorSchemes.map((scheme) => (
                <TouchableOpacity
                  key={scheme.value}
                  style={[
                    styles.colorCard,
                    colorScheme === scheme.value && styles.colorCardActive
                  ]}
                  onPress={() => setColorScheme(scheme.value)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.colorSwatch, { backgroundColor: scheme.color }]} />
                  <Text style={styles.colorLabel}>{scheme.label}</Text>
                  {colorScheme === scheme.value && (
                    <View style={styles.checkContainer}>
                      <Check size={16} color="#ffffff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
        
        {/* Revision Goals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revision Goals</Text>
          
          {/* Daily Target */}
          <View style={styles.settingItem}>
            <View style={styles.settingHeader}>
              <View style={styles.iconContainer}>
                <Target size={20} color="#4CAF50" />
              </View>
              <View>
                <Text style={styles.settingLabel}>Daily Verse Target</Text>
                <Text style={styles.settingDescription}>Set your daily revision goal</Text>
              </View>
            </View>
            <View style={styles.toggleGrid}>
              {dailyTargets.map((target) => (
                <TouchableOpacity
                  key={target}
                  style={[
                    styles.toggleChip,
                    dailyRevisionTarget === target && styles.toggleChipActive
                  ]}
                  onPress={() => setDailyRevisionTarget(target)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.toggleChipText,
                    dailyRevisionTarget === target && styles.toggleChipTextActive
                  ]}>{target} verses</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Weekly Target */}
          <View style={styles.settingItem}>
            <View style={styles.settingHeader}>
              <View style={styles.iconContainer}>
                <RotateCcw size={20} color="#FF9800" />
              </View>
              <View>
                <Text style={styles.settingLabel}>Weekly Surah Target</Text>
                <Text style={styles.settingDescription}>Set your weekly surah goal</Text>
              </View>
            </View>
            <View style={styles.toggleGrid}>
              {weeklyTargets.map((target) => (
                <TouchableOpacity
                  key={target}
                  style={[
                    styles.toggleChip,
                    weeklyRevisionTarget === target && styles.toggleChipActive
                  ]}
                  onPress={() => setWeeklyRevisionTarget(target)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.toggleChipText,
                    weeklyRevisionTarget === target && styles.toggleChipTextActive
                  ]}>{target} {target === 1 ? 'surah' : 'surahs'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
        
        {/* Audio Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Audio Settings</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.iconContainer}>
                  <Volume2 size={20} color="#2196F3" />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Auto-play Audio</Text>
                  <Text style={styles.settingDescription}>
                    Automatically play audio when viewing verses
                  </Text>
                </View>
              </View>
              <Switch
                value={autoPlayAudio}
                onValueChange={setAutoPlayAudio}
                trackColor={{ false: '#444444', true: '#2196F380' }}
                thumbColor={autoPlayAudio ? '#2196F3' : '#888888'}
                ios_backgroundColor="#444444"
              />
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingHeader}>
              <View style={styles.iconContainer}>
                <RotateCcw size={20} color="#9C27B0" />
              </View>
              <View>
                <Text style={styles.settingLabel}>Audio Repeat</Text>
                <Text style={styles.settingDescription}>Number of times to repeat audio</Text>
              </View>
            </View>
            <View style={styles.toggleGrid}>
              {[1, 2, 3, 5, 10].map((count) => (
                <TouchableOpacity
                  key={count}
                  style={[
                    styles.toggleChip,
                    repeatMode === count && styles.toggleChipActive
                  ]}
                  onPress={() => setRepeatMode(count)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.toggleChipText,
                    repeatMode === count && styles.toggleChipTextActive
                  ]}>{count}×</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
        
        {/* Notification Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.iconContainer}>
                  <Bell size={20} color="#9C27B0" />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Daily Reminders</Text>
                  <Text style={styles.settingDescription}>
                    Get notified to maintain your revision streak
                  </Text>
                </View>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#444444', true: '#9C27B080' }}
                thumbColor={notificationsEnabled ? '#9C27B0' : '#888888'}
                ios_backgroundColor="#444444"
              />
            </View>
          </View>

          {notificationsEnabled && (
            <View style={[styles.settingItem, styles.nestedSetting]}>
              <View style={styles.settingHeader}>
                <Text style={styles.nestedLabel}>Reminder Time</Text>
              </View>
              <TouchableOpacity
                style={styles.timeSelector}
                onPress={() => {
                  // TODO: Implement time picker
                  // For now, just toggle between 9 AM and 9 PM
                  const currentTime = reminderTime;
                  const newTime = currentTime === '09:00' ? '21:00' : '09:00';
                  setReminderTime(newTime);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.timeSelectorText}>{reminderTime}</Text>
                <Text style={styles.timeSelectorSubtext}>
                  {reminderTime === '09:00' ? 'Morning' : 'Evening'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Data Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>

          <View style={styles.dataCard}>
            <View style={styles.dataHeader}>
              <View style={[styles.iconContainer, { backgroundColor: '#0e1a12' }]}>
                <RotateCcw size={18} color="#4CAF50" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dataTitle}>Update Activity Data</Text>
                <Text style={styles.dataSubtitle}>Backfill your stats using existing memorization dates.</Text>
              </View>
            </View>
            <BackfillButton />
          </View>
        </View>

        {/* App version label */}
        <View style={styles.versionRow}>
          <Text style={styles.versionText}>Ver-1.2.1</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    paddingBottom: 32,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    backgroundColor: '#000000',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#0a0a0a',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  dataCard: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#1f2a1f',
    borderRadius: 14,
    padding: 16,
  },
  dataHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dataTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  dataSubtitle: {
    color: '#aaaaaa',
    fontSize: 12,
    marginTop: 2,
  },
  versionRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    alignItems: 'center',
  },
  versionText: {
    color: '#777',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginLeft: 48,
  },
  settingItem: {
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: '#888888',
    lineHeight: 18,
  },
  nestedSetting: {
    backgroundColor: '#151515',
    borderRadius: 12,
    padding: 16,
    marginLeft: 8,
  },
  nestedLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#cccccc',
    marginBottom: 0,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  colorCardActive: {
    borderColor: '#2196F3',
    backgroundColor: '#1a2332',
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 3,
    borderColor: '#ffffff20',
  },
  colorLabel: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  checkContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleChip: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#2a2a2a',
  },
  toggleChipActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  toggleChipText: {
    fontSize: 14,
    color: '#cccccc',
    fontWeight: '500',
  },
  toggleChipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  timeSelector: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  timeSelectorText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  timeSelectorSubtext: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
  },
});