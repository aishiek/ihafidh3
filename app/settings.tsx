import { BackfillButton } from '@/components/BackfillButton';
import Slider from '@/components/ui/Slider';
import { useSettingsStore } from '@/store/settingsStore';
import { getArabicFontFamily, getArabicTypographySizing } from '@/utils/fontUtils';
import { useCustomColors } from '@/utils/themeUtils';
import { router, Stack } from 'expo-router';
import {
    ArrowLeft,
    Bell,
    Book,
    Check,
    ChevronRight,
    Clock,
    Moon,
    Palette,
    RotateCcw,
    Sun,
    Target,
    User,
    Volume2
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useActivityStore } from '../store/activityStore';
import { ColorScheme, useThemeStore } from '../store/themeStore';
import { runFullDiagnostic } from './mushaf/utils/mushafDiagnostics';

export default function SettingsScreen() {
  const colors = useCustomColors();
  
  const {
    userName,
    setUserName,
    fontSizeArabic,
    fontSizeTranslation,
    fontSizeTransliteration,
    setFontSizeArabic,
    setFontSizeTranslation,
    setFontSizeTransliteration,
    showTranslation,
    setShowTranslation,
    autoPlayAudio,
    setAutoPlayAudio,
    notificationsEnabled,
    setNotificationsEnabled,
    ayahDailyNotificationsEnabled,
    setAyahDailyNotificationsEnabled,
    repeatMode,
    setRepeatMode,
    reminderTime,
    setReminderTime,
    translationLanguage,
    setTranslationLanguage,
    arabicFont,
    setArabicFont,
    revisionReminderSettings,
    setRevisionReminderSettings
  } = useSettingsStore();
  const arabicFamily = useMemo(() => getArabicFontFamily(arabicFont) || undefined, [arabicFont]);
  const [arabicPreview, setArabicPreview] = useState<number>(fontSizeArabic);
  const [transPreview, setTransPreview] = useState<number>(fontSizeTranslation);
  const [translitPreview, setTranslitPreview] = useState<number>(fontSizeTransliteration || 14);

  // Keep local previews in sync if store updates from elsewhere
  React.useEffect(() => {
    if (arabicPreview !== fontSizeArabic) setArabicPreview(fontSizeArabic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSizeArabic]);
  React.useEffect(() => {
    if (transPreview !== fontSizeTranslation) setTransPreview(fontSizeTranslation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSizeTranslation]);
  React.useEffect(() => {
    const v = fontSizeTransliteration || 14;
    if (translitPreview !== v) setTranslitPreview(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSizeTransliteration]);
  const arabicTypo = useMemo(() => getArabicTypographySizing(arabicPreview, arabicFont), [arabicPreview, arabicFont]);
  
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
        
        {/* Mushaf Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mushaf Layouts</Text>
          
          <TouchableOpacity
            style={styles.navigationItem}
            onPress={() => router.push('/mushaf/settings')}
            activeOpacity={0.7}
          >
            <View style={styles.settingHeader}>
              <View style={styles.iconContainer}>
                <Book size={20} color="#10b981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Manage Mushaf Layouts</Text>
                <Text style={styles.settingDescription}>
                  Download and manage Madina, Indo-Pak, Warsh, and Tajweed layouts
                </Text>
              </View>
              <ChevronRight size={20} color="#666666" />
            </View>
          </TouchableOpacity>
        </View>
        
        {/* Theme Settings */}

        {/* Translation Language Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Translation Language</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 8 }}>
            {require('../constants/translationLanguages').TRANSLATION_LANGUAGES.map((lang: { identifier: string; name: string; language: string }) => (
              <TouchableOpacity
                key={lang.identifier === 'my.ghazi' ? 'ms.basmeih' : lang.identifier}
                style={[styles.toggleChip, translationLanguage === (lang.identifier === 'my.ghazi' ? 'ms.basmeih' : lang.identifier) && styles.toggleChipActive]}
                onPress={() => setTranslationLanguage(lang.identifier === 'my.ghazi' ? 'ms.basmeih' : lang.identifier)}
                activeOpacity={0.7}
              >
                <Text style={[styles.toggleChipText, translationLanguage === (lang.identifier === 'my.ghazi' ? 'ms.basmeih' : lang.identifier) && styles.toggleChipTextActive]}>{lang.language === 'ms' || lang.identifier === 'my.ghazi' ? 'Malay' : lang.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
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
        
        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          {/* Daily Ayah Notification */}
          <View style={styles.settingItem}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.iconContainer}>
                  <Bell size={20} color="#4CAF50" />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Daily Ayah Notification</Text>
                  <Text style={styles.settingDescription}>
                    Receive a daily verse notification
                  </Text>
                </View>
              </View>
              <Switch
                value={false}
                onValueChange={() => {}}
                trackColor={{ false: '#444444', true: '#4CAF5080' }}
                thumbColor={false ? '#4CAF50' : '#888888'}
                ios_backgroundColor="#444444"
              />
            </View>
          </View>

          {/* Daily Verse */}
          <View style={styles.settingItem}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.iconContainer}>
                  <Book size={20} color="#2196F3" />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Daily Verse</Text>
                  <Text style={styles.settingDescription}>
                    Get notified with a verse each day
                  </Text>
                </View>
              </View>
              <Switch
                value={false}
                onValueChange={() => {}}
                trackColor={{ false: '#444444', true: '#2196F380' }}
                thumbColor={false ? '#2196F3' : '#888888'}
                ios_backgroundColor="#444444"
              />
            </View>
          </View>

          {/* Weekly Surahs */}
          <View style={styles.settingItem}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.iconContainer}>
                  <RotateCcw size={20} color="#FF9800" />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Weekly Surahs</Text>
                  <Text style={styles.settingDescription}>
                    Weekly surah revision reminders
                  </Text>
                </View>
              </View>
              <Switch
                value={false}
                onValueChange={() => {}}
                trackColor={{ false: '#444444', true: '#FF980080' }}
                thumbColor={false ? '#FF9800' : '#888888'}
                ios_backgroundColor="#444444"
              />
            </View>
          </View>

          {/* Hifdh Planner */}
          <View style={styles.settingItem}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.iconContainer}>
                  <Target size={20} color="#9C27B0" />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Hifdh Planner</Text>
                  <Text style={styles.settingDescription}>
                    Get reminders for your memorization plan
                  </Text>
                </View>
              </View>
              <Switch
                value={false}
                onValueChange={() => {}}
                trackColor={{ false: '#444444', true: '#9C27B080' }}
                thumbColor={false ? '#9C27B0' : '#888888'}
                ios_backgroundColor="#444444"
              />
            </View>
          </View>

          {/* Revision Reminder */}
          <View style={styles.settingItem}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.iconContainer}>
                  <Clock size={20} color="#FF5722" />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Surah Revision Reminder (9 PM)</Text>
                  <Text style={styles.settingDescription}>
                    Check for fully memorized surahs needing revision
                  </Text>
                </View>
              </View>
              <Switch
                value={revisionReminderSettings.enabled}
                onValueChange={(enabled) => 
                  setRevisionReminderSettings({ ...revisionReminderSettings, enabled })
                }
                trackColor={{ false: '#444444', true: '#FF572280' }}
                thumbColor={revisionReminderSettings.enabled ? '#FF5722' : '#888888'}
                ios_backgroundColor="#444444"
              />
            </View>
            {revisionReminderSettings.enabled && (
              <View style={styles.settingSubItem}>
                <Text style={styles.settingSubLabel}>Days before reminder:</Text>
                <View style={styles.daysInputContainer}>
                  <TextInput
                    style={styles.daysInput}
                    value={revisionReminderSettings.daysThreshold.toString()}
                    onChangeText={(text) => {
                      const days = parseInt(text) || 3;
                      if (days >= 1 && days <= 30) {
                        setRevisionReminderSettings({ 
                          ...revisionReminderSettings, 
                          daysThreshold: days 
                        });
                      }
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={styles.daysLabel}>days</Text>
                </View>
              </View>
            )}
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
          
          {/* Ayah of the Day Notification Toggle (single, fixed) */}
          <View style={styles.settingItem}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.iconContainer}>
                  <Bell size={20} color="#03A9F4" />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Ayah of the Day Notification</Text>
                  <Text style={styles.settingDescription}>
                    Receive a daily notification with the Ayah of the Day
                  </Text>
                </View>
              </View>
              <Switch
                value={!!ayahDailyNotificationsEnabled}
                onValueChange={setAyahDailyNotificationsEnabled}
                trackColor={{ false: '#444444', true: '#03A9F480' }}
                thumbColor={ayahDailyNotificationsEnabled ? '#03A9F4' : '#888888'}
                ios_backgroundColor="#444444"
              />
            </View>
          </View>

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

        {/* Reading Font Sizes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reading Font Sizes</Text>
          {/* Arabic Size */}
          <View style={styles.settingItem}>
            <View style={styles.settingHeader}>
              <View style={styles.iconContainer}>
                <Palette size={20} color="#FFD700" />
              </View>
              <View>
                <Text style={styles.settingLabel}>Arabic size</Text>
                <Text style={styles.settingDescription}>Adjust the Quranic Arabic font size</Text>
              </View>
            </View>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: '#aaa' }}>Size: {Math.round(arabicPreview)}</Text>
                <Text style={{ color: '#aaa' }}>Line: {arabicTypo.lineHeight}</Text>
              </View>
              <Slider
                value={arabicPreview}
                min={16}
                max={54}
                step={1}
                trackColor="#333333"
                filledColor={colors.primary}
                thumbColor={colors.primary}
                onChangeEnd={(v) => {
                  // ✅ ZERO parent callbacks during drag - only update on release
                  const rounded = Math.round(v);
                  setArabicPreview(rounded);
                  setFontSizeArabic(rounded);
                }}
              />
              <View style={{ padding: 12, backgroundColor: '#111', borderRadius: 10, borderWidth: 1, borderColor: '#222' }}>
                <Text style={{ color: '#fff', fontFamily: arabicFamily, fontSize: arabicTypo.fontSize, lineHeight: arabicTypo.lineHeight, textAlign: 'right' }}>
                  بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ
                </Text>
              </View>
            </View>
          </View>

          {/* Translation Size */}
          <View style={styles.settingItem}>
            <View style={styles.settingHeader}>
              <View style={styles.iconContainer}>
                <Palette size={20} color="#4CAF50" />
              </View>
              <View>
                <Text style={styles.settingLabel}>Translation size</Text>
                <Text style={styles.settingDescription}>Adjust the translation font size</Text>
              </View>
            </View>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: '#aaa' }}>Size: {Math.round(transPreview)}</Text>
                <Text style={{ color: '#aaa' }}>Line: {Math.round(transPreview * 1.4)}</Text>
              </View>
              <Slider
                value={transPreview}
                min={12}
                max={28}
                step={1}
                trackColor="#333333"
                filledColor={colors.primary}
                thumbColor={colors.primary}
                onChangeEnd={(v) => {
                  // ✅ ZERO parent callbacks during drag - only update on release
                  const rounded = Math.round(v);
                  setTransPreview(rounded);
                  setFontSizeTranslation(rounded);
                }}
              />
              <View style={{ padding: 12, backgroundColor: '#111', borderRadius: 10, borderWidth: 1, borderColor: '#222' }}>
                <Text style={{ color: '#ddd', fontSize: transPreview, lineHeight: Math.round(transPreview * 1.4) }}>
                  In the name of Allah, the Most Gracious, the Most Merciful.
                </Text>
              </View>
            </View>
          </View>

          {/* Transliteration Size */}
          <View style={styles.settingItem}>
            <View style={styles.settingHeader}>
              <View style={styles.iconContainer}>
                <Palette size={20} color="#9C27B0" />
              </View>
              <View>
                <Text style={styles.settingLabel}>Transliteration size</Text>
                <Text style={styles.settingDescription}>Adjust the transliteration font size</Text>
              </View>
            </View>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: '#aaa' }}>Size: {Math.round(translitPreview)}</Text>
                <Text style={{ color: '#aaa' }}>Line: {Math.round(translitPreview * 1.35)}</Text>
              </View>
              <Slider
                value={translitPreview}
                min={12}
                max={26}
                step={1}
                trackColor="#333333"
                filledColor={colors.primary}
                thumbColor={colors.primary}
                onChangeEnd={(v) => {
                  // ✅ ZERO parent callbacks during drag - only update on release
                  const rounded = Math.round(v);
                  setTranslitPreview(rounded);
                  setFontSizeTransliteration(rounded);
                }}
              />
              <View style={{ padding: 12, backgroundColor: '#111', borderRadius: 10, borderWidth: 1, borderColor: '#222' }}>
                <Text style={{ color: '#FFD700', fontSize: translitPreview, lineHeight: Math.round(translitPreview * 1.35) }}>
                  Bismillāhir Raḥmānir Raḥīm
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Arabic Font Style */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Arabic Font Style</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingHeader}>
              <View style={styles.iconContainer}>
                <Palette size={20} color="#9C27B0" />
              </View>
              <View>
                <Text style={styles.settingLabel}>Font Style</Text>
                <Text style={styles.settingDescription}>Choose your preferred Arabic font</Text>
              </View>
            </View>
            <View style={styles.toggleGrid}>
              {[
                { value: 'default', label: 'System Default' },
                { value: 'noto-naskh', label: 'Naskh Arabic' },
                { value: 'amiri-quran', label: 'Amiri' },
                { value: 'indo-pak', label: 'Indo-Pak' },
              ].map((font) => (
                <TouchableOpacity
                  key={font.value}
                  style={[
                    styles.toggleChip,
                    arabicFont === font.value && styles.toggleChipActive
                  ]}
                  onPress={() => setArabicFont(font.value as any)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.toggleChipText,
                    arabicFont === font.value && styles.toggleChipTextActive
                  ]}>{font.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
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

        {/* Diagnostic (debug) - temporary button */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diagnostics (debug)</Text>
          <View style={styles.settingItem}>
            <TouchableOpacity
              onPress={async () => {
                try {
                  const ok = await runFullDiagnostic();
                  // runFullDiagnostic already shows alerts, but give a quick toast-like feedback
                  // using simple Alert
                  if (ok) {
                    // nothing else
                  }
                } catch (e) {
                  // ignored - runFullDiagnostic alerts
                }
              }}
              style={[styles.downloadButton, { paddingVertical: 12 }]}
            >
              <Text style={styles.downloadButtonText}>Run RNFS Diagnostic</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* App version label */}
        <View style={styles.versionRow}>
          <Text style={styles.versionText}>Ver-2.0.0</Text>
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
  navigationItem: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1a1a1a',
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
  settingSubItem: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 44, // Align with text above
  },
  settingSubLabel: {
    fontSize: 14,
    color: '#aaaaaa',
    fontWeight: '500',
  },
  daysInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  daysInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
    minWidth: 50,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  daysLabel: {
    fontSize: 14,
    color: '#888888',
    fontWeight: '500',
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
  downloadButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});