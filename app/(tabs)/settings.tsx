import { useFastingCalendar } from '@/components/fasting/context/FastingCalendarContext';
import LocationSelector from '@/components/LocationSelector';
import NotificationSettingsCard from '@/components/settings/NotificationSettingsCard';
import { RECITERS } from '@/constants/reciters';
import { TRANSLATION_LANGUAGES } from '@/constants/translationLanguages';
import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import { useSettingsStore } from '@/store/settingsStore';
import { useThemeStore } from '@/store/themeStore';
import { FastingLocation } from '@/types/fasting';
// import { useThemeColor } from '@/utils/useThemeColor';
import { Slider } from '@/components/ui/Slider';
import { getArabicFontFamily, getArabicTypographySizing } from '@/utils/fontUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { router, Stack } from 'expo-router';
import { Bell, Calendar, Globe, MessageSquare, Music, Play, Square, User } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const USER_NAME_KEY = 'user_name';

export default function SettingsScreen() {
  const { theme, colorScheme, setColorScheme } = useThemeStore();
  const { userName, translationLanguage, reciterIdentifier, showTranslation, showTransliteration, fontSizeArabic, fontSizeTransliteration, fontSizeTranslation, arabicFont, setUserName, setTranslationLanguage, setReciterIdentifier, setShowTranslation, setShowTransliteration, setFontSizeArabic, setFontSizeTransliteration, setFontSizeTranslation, setArabicFont } = useSettingsStore();

  // Mixed state management integration
  const unifiedTheme = useUnifiedTheme();
  const fastingContext = useFastingCalendar();
  const [debugTapCount, setDebugTapCount] = useState(0);
  const [localName, setLocalName] = useState(userName || '');
  const [selectedTranslation, setSelectedTranslation] = useState(translationLanguage || 'en.asad');
  const [selectedReciter, setSelectedReciter] = useState(reciterIdentifier || 'ar.alafasy');
  const [localShowTranslation, setLocalShowTranslation] = useState(showTranslation ?? true);
  const [localShowTransliteration, setLocalShowTransliteration] = useState(showTransliteration ?? false);
  const [localArabicFont, setLocalArabicFont] = useState(arabicFont || 'default');
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  // Live preview font sizes with commit-on-release
  const [arabicSizePreview, setArabicSizePreview] = useState<number>(fontSizeArabic ?? 24);
  const [translationSizePreview, setTranslationSizePreview] = useState<number>(fontSizeTranslation ?? 16);
  const [translitSizePreview, setTranslitSizePreview] = useState<number>(fontSizeTransliteration ?? 14);
  const [previewSound, setPreviewSound] = useState<Audio.Sound | null>(null);
  const [playingReciter, setPlayingReciter] = useState<string | null>(null);
  const [isSliderActive, setIsSliderActive] = useState(false);

  // Sync previews with store if changed elsewhere
  React.useEffect(() => {
    if (arabicSizePreview !== (fontSizeArabic ?? 24)) setArabicSizePreview(fontSizeArabic ?? 24);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSizeArabic]);
  React.useEffect(() => {
    if (translationSizePreview !== (fontSizeTranslation ?? 16)) setTranslationSizePreview(fontSizeTranslation ?? 16);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSizeTranslation]);
  React.useEffect(() => {
    if (translitSizePreview !== (fontSizeTransliteration ?? 14)) setTranslitSizePreview(fontSizeTransliteration ?? 14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSizeTransliteration]);

  // Track if any changes have been made
  const hasChanges = useMemo(() => {
    return (
      localName !== userName ||
      selectedTranslation !== translationLanguage ||
      selectedReciter !== reciterIdentifier ||
      localShowTranslation !== showTranslation ||
      localShowTransliteration !== showTransliteration ||
      localArabicFont !== arabicFont
    );
  }, [
    localName, userName,
    selectedTranslation, translationLanguage,
    selectedReciter, reciterIdentifier,
    localShowTranslation, showTranslation,
    localShowTransliteration, showTransliteration,
    localArabicFont, arabicFont
  ]);

  const saveUserData = async () => {
    try {
      const trimmedName = localName.trim();

      console.log('Saving user data - name before:', userName);

      // Update Zustand store and AsyncStorage
      setUserName(trimmedName);
      setTranslationLanguage(selectedTranslation);
      setReciterIdentifier(selectedReciter);
      setShowTranslation(localShowTranslation);
      setShowTransliteration(localShowTransliteration);
      setArabicFont(localArabicFont);
      await AsyncStorage.setItem(USER_NAME_KEY, trimmedName);

      console.log('Saving user data - name after:', trimmedName);

      Alert.alert(
        'Settings Saved',
        'Your personal information and preferences have been saved successfully.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error saving user data:', error);
      Alert.alert(
        'Error',
        'Failed to save settings. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const sendFeedback = () => {
    const emailSubject = 'iHafidh App Feedback';
    const emailBody = 'Hello iHafidh Team,\n\nI would like to share my feedback:\n\n';
    const mailtoUrl = `mailto:iHafidhapp@gmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    // Try to open the native email client using mailto: which works on iOS & Android
    Linking.openURL(mailtoUrl).catch((err) => {
      console.error('Error opening email client:', err);
      // Fallback: inform the user with the address (no automatic copying)
      Alert.alert(
        'Send Feedback',
        'Unable to open your email app. Please send your feedback to:\n\n\niHafidhapp@gmail.com',
        [{ text: 'OK' }]
      );
    });
  };

  // Audio preview for reciter selection
  const playPreview = async () => {
    try {
      // Stop any currently playing preview
      if (previewSound) {
        await previewSound.stopAsync();
        await previewSound.unloadAsync();
        setPreviewSound(null);
      }

      // Al-Fatiha verse 2 (Alhamdu lillahi rabbil aalameen)
      const previewUrl = `https://cdn.alquran.cloud/media/audio/ayah/${selectedReciter}/2`;

      setPlayingReciter(selectedReciter);
      const { sound } = await Audio.Sound.createAsync(
        { uri: previewUrl },
        { shouldPlay: true }
      );

      setPreviewSound(sound);

      // Auto-stop when finished
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingReciter(null);
          sound.unloadAsync();
          setPreviewSound(null);
        }
      });
    } catch (error) {
      console.error('Error playing preview:', error);
      setPlayingReciter(null);
      Alert.alert('Preview Error', 'Unable to play audio preview. Please check your connection.');
    }
  };

  const stopPreview = async () => {
    try {
      if (previewSound) {
        await previewSound.stopAsync();
        await previewSound.unloadAsync();
        setPreviewSound(null);
      }
      setPlayingReciter(null);
    } catch (error) {
      console.error('Error stopping preview:', error);
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (previewSound) {
        previewSound.unloadAsync();
      }
    };
  }, [previewSound]);

  const handleLocationChange = async (location: FastingLocation) => {
    try {
      if (fastingContext?.updateSettings) {
        await fastingContext.updateSettings({ location });
        setShowLocationSelector(false);
      }
    } catch (error) {
      console.error('Error updating location:', error);
      Alert.alert('Error', 'Failed to update location. Please try again.');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContainer: {
      padding: 16,
    },
    section: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },
    sectionIcon: {
      marginRight: 8,
    },
    inputLabel: {
      fontSize: 14,
      color: '#FFFFFF',
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.inactive,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.text,
      marginBottom: 12,
    },
    saveButton: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingVertical: 14,
      paddingHorizontal: 24,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    feedbackButton: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      marginBottom: 12,
    },
    feedbackButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    feedbackText: {
      fontSize: 14,
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: 16,
      lineHeight: 20,
    },
    pickerContainer: {
      marginBottom: 12,
    },
    pickerScrollContent: {
      paddingHorizontal: 4,
    },
    languageOption: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.inactive,
      borderRadius: 8,
      padding: 12,
      marginHorizontal: 4,
      minWidth: 120,
      alignItems: 'center',
    },
    reciterOption: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.inactive,
      borderRadius: 8,
      padding: 12,
      marginHorizontal: 4,
      minWidth: 160,
      alignItems: 'center',
    },
    languageOptionSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    reciterOptionSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    languageOptionText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    reciterOptionText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    languageOptionTextSelected: {
      color: '#FFFFFF',
    },
    reciterOptionTextSelected: {
      color: '#FFFFFF',
    },
    previewButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 4,
      marginTop: 6,
      marginBottom: 6,
      borderWidth: 1,
      alignSelf: 'center',
    },
    previewButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
    languageOptionSubtext: {
      fontSize: 10,
      color: '#FFFFFF',
      textAlign: 'center',
      marginTop: 2,
    },
    languageOptionSubtextSelected: {
      color: '#FFFFFF',
      opacity: 0.8,
    },
    displayOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      marginBottom: 4,
    },
    interactiveOption: {
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    displayOptionText: {
      fontSize: 16,
    },
    displayOptionTick: {
      fontSize: 16,
    },
    saveButtonContainer: {
      marginTop: 16,
      marginBottom: 8,
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.primary,
      borderStyle: 'dashed',
    },
    saveButtonHint: {
      fontSize: 12,
      color: '#FFFFFF',
      marginTop: 4,
    },
    noChangesContainer: {
      marginTop: 16,
      marginBottom: 8,
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: '#FFFFFF',
      borderStyle: 'dashed',
    },
    noChangesText: {
      fontSize: 14,
      color: '#FFFFFF',
      textAlign: 'center',
      marginTop: 4,
    },
    changeIndicator: {
      fontSize: 11,
      color: theme.primary,
      marginTop: 4,
      marginBottom: 8,
      fontStyle: 'italic',
      opacity: 0.8,
    },
    toggleSwitch: {
      width: 36,
      height: 20,
      borderRadius: 10,
      padding: 2,
      justifyContent: 'center',
    },
    toggleThumb: {
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    versionRow: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 24,
      alignItems: 'center',
    },
    versionText: {
      color: '#FFFFFF',
      fontSize: 12,
      letterSpacing: 0.5,
    },
  });

  function getDisplayLanguage(langCode: string): string {
    const map: Record<string, string> = {
      en: 'English',
      ta: 'Tamil',
      ur: 'Urdu',
      bn: 'Bengali',
      zh: 'Chinese',
      ml: 'Malayalam',
      de: 'German',
      es: 'Spanish',
      fr: 'French',
      hi: 'Hindi',
      id: 'Bahasa',

      ru: 'Russian',
      tr: 'Turkish',
      ms: 'Malay',
    };
    return map[langCode] || langCode.toUpperCase();
  }

  return (
    <View style={styles.container}>
      {/* Floating slim save bar */}
      {hasChanges && (
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 10 }}>
          <Pressable onPress={saveUserData} style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.primary,
            borderRadius: 20,
            paddingVertical: 8,
            paddingHorizontal: 16,
            minWidth: 140,
            alignSelf: 'center',
            opacity: 0.94,
            borderWidth: 0.5,
            borderColor: 'rgba(255,255,255,0.12)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 3,
            elevation: 2,
          }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Save</Text>
          </Pressable>
        </View>
      )}

      <Stack.Screen
        options={{
          title: 'Setup',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />

      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isSliderActive}
      >
        {/* Personal Information Section */}
        <View style={styles.section}>
          <View style={styles.sectionTitle}>
            <User size={20} color={theme.primary} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Personal Information</Text>
          </View>

          <Text style={styles.inputLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={localName}
            onChangeText={setLocalName}
            placeholder="Enter your name"
            placeholderTextColor={theme.inactive}
          />
        </View>

        {/* Reading Settings */}
        <View style={styles.section}>
          <View style={styles.sectionTitle}>
            <Music size={20} color={theme.primary} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Reading Settings</Text>
          </View>

          <Text style={styles.inputLabel}>Reciter</Text>
          <View style={styles.pickerContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickerScrollContent}
            >
              {RECITERS.map((r) => (
                <Pressable
                  key={r.identifier}
                  style={[
                    styles.reciterOption,
                    selectedReciter === r.identifier && styles.reciterOptionSelected
                  ]}
                  onPress={() => setSelectedReciter(r.identifier)}
                >
                  <Text style={[
                    styles.reciterOptionText,
                    selectedReciter === r.identifier && styles.reciterOptionTextSelected
                  ]}>
                    {r.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Preview Button */}
          <Pressable
            style={[
              styles.previewButton,
              {
                backgroundColor: playingReciter === selectedReciter ? '#ef4444' : theme.primary,
                borderColor: theme.primary
              }
            ]}
            onPress={playingReciter === selectedReciter ? stopPreview : playPreview}
          >
            {playingReciter === selectedReciter ? (
              <Square size={14} color="#fff" fill="#fff" style={{ marginRight: 6 }} />
            ) : (
              <Play size={14} color="#fff" fill="#fff" style={{ marginRight: 6 }} />
            )}
            <Text style={styles.previewButtonText}>
              {playingReciter === selectedReciter ? 'Stop' : 'Preview'}
            </Text>
          </Pressable>

          <Text style={styles.inputLabel}>Translation Language</Text>
          <View style={styles.pickerContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickerScrollContent}
            >
              {TRANSLATION_LANGUAGES.map((lang) => (
                <Pressable
                  key={lang.identifier}
                  style={[
                    styles.languageOption,
                    selectedTranslation === lang.identifier && styles.languageOptionSelected
                  ]}
                  onPress={() => setSelectedTranslation(lang.identifier)}
                >
                  <Text style={[
                    styles.languageOptionText,
                    selectedTranslation === lang.identifier && styles.languageOptionTextSelected
                  ]}>
                    {getDisplayLanguage(lang.language)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Display Options */}
        <View style={styles.section}>
          <View style={styles.sectionTitle}>
            <Globe size={20} color={theme.primary} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Display Options</Text>
          </View>
          <Pressable
            onPress={() => setLocalShowTranslation(!localShowTranslation)}
            style={styles.displayOption}
          >
            <Text style={[styles.displayOptionText, { color: theme.text }]}>Show Translation</Text>
            <View style={[
              styles.toggleSwitch,
              { backgroundColor: localShowTranslation ? theme.primary : theme.inactive }
            ]}>
              <View style={[
                styles.toggleThumb,
                {
                  transform: [{ translateX: localShowTranslation ? 16 : 0 }],
                  backgroundColor: '#FFFFFF'
                }
              ]} />
            </View>
          </Pressable>

          <Pressable
            onPress={() => setLocalShowTransliteration(!localShowTransliteration)}
            style={styles.displayOption}
          >
            <Text style={[styles.displayOptionText, { color: theme.text }]}>Show Transliteration</Text>
            <View style={[
              styles.toggleSwitch,
              { backgroundColor: localShowTransliteration ? theme.primary : theme.inactive }
            ]}>
              <View style={[
                styles.toggleThumb,
                {
                  transform: [{ translateX: localShowTransliteration ? 16 : 0 }],
                  backgroundColor: '#FFFFFF'
                }
              ]} />
            </View>
          </Pressable>

          {/* Theme Colors */}
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.inputLabel, { marginBottom: 12 }]}>Theme Color</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {[
                { value: 'blue', color: '#2196F3', label: 'Blue' },
                { value: 'green', color: '#4CAF50', label: 'Green' },
                { value: 'purple', color: '#9C27B0', label: 'Purple' },
                { value: 'orange', color: '#FF9800', label: 'Orange' }
              ].map((themeColor) => (
                <Pressable
                  key={themeColor.value}
                  onPress={() => setColorScheme(themeColor.value as any)}
                  style={{
                    alignItems: 'center',
                    flex: 1,
                    marginHorizontal: 2,
                  }}
                >
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: themeColor.color,
                    borderWidth: 3,
                    borderColor: colorScheme === themeColor.value ? '#FFFFFF' : 'transparent',
                    marginBottom: 4,
                    shadowColor: colorScheme === themeColor.value ? themeColor.color : 'transparent',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4,
                    elevation: colorScheme === themeColor.value ? 4 : 0,
                  }} />
                  <Text style={{
                    color: theme.text,
                    fontSize: 11,
                    fontWeight: colorScheme === themeColor.value ? 'bold' : 'normal'
                  }}>
                    {themeColor.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Arabic Font Selection */}
        <View style={styles.section}>
          <View style={styles.sectionTitle}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Arabic Font</Text>
          </View>

          <Text style={{ color: theme.text, marginBottom: 12 }}>
            Choose the font for Arabic text display
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {[
              { value: 'default', label: 'System Default (Scheherazade)' },
              { value: 'noto-naskh', label: 'Naskh Arabic' },
              { value: 'amiri-quran', label: 'Amiri Quran' },
              { value: 'indo-pak', label: 'Indo-Pak (Noore Huda)' },
              { value: 'tajweed', label: 'Tajweed (KFGQPC)' }
            ].map((font) => (
              <Pressable
                key={font.value}
                onPress={() => {
                  setLocalArabicFont(font.value as any);
                  setArabicFont(font.value as any);
                }}
                style={{
                  alignItems: 'center',
                  width: '48%',
                  padding: 12,
                  marginBottom: 8,
                  borderRadius: 8,
                  backgroundColor: localArabicFont === font.value ? theme.primary : 'transparent',
                  borderWidth: 1,
                  borderColor: localArabicFont === font.value ? theme.primary : theme.inactive,
                }}
              >
                <Text style={{
                  color: localArabicFont === font.value ? '#FFFFFF' : theme.text,
                  fontSize: 12,
                  textAlign: 'center',
                  fontWeight: localArabicFont === font.value ? 'bold' : 'normal'
                }}>
                  {font.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Tajweed Color Legend - Show only when Tajweed is selected */}
          {localArabicFont === 'tajweed' && (
            <View style={{ marginTop: 16, padding: 12, backgroundColor: theme.card, borderRadius: 8 }}>
              <Text style={{ color: theme.text, fontSize: 14, fontWeight: 'bold', marginBottom: 8 }}>
                Tajweed Color Guide (using rn-tajweed-verse library):
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 }}>
                  <View style={{ width: 12, height: 12, backgroundColor: '#FFD700', borderRadius: 2, marginRight: 6 }} />
                  <Text style={{ color: theme.text, fontSize: 12 }}>Ghunnah</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 }}>
                  <View style={{ width: 12, height: 12, backgroundColor: '#FF3B30', borderRadius: 2, marginRight: 6 }} />
                  <Text style={{ color: theme.text, fontSize: 12 }}>Qalqalah</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 }}>
                  <View style={{ width: 12, height: 12, backgroundColor: '#FFD700', borderRadius: 2, marginRight: 6 }} />
                  <Text style={{ color: theme.text, fontSize: 12 }}>Noon/Meem Mushaddad</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 }}>
                  <View style={{ width: 12, height: 12, backgroundColor: '#00C853', borderRadius: 2, marginRight: 6 }} />
                  <Text style={{ color: theme.text, fontSize: 12 }}>Idgham</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 }}>
                  <View style={{ width: 12, height: 12, backgroundColor: '#FFA500', borderRadius: 2, marginRight: 6 }} />
                  <Text style={{ color: theme.text, fontSize: 12 }}>Madd</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 }}>
                  <View style={{ width: 12, height: 12, backgroundColor: '#007AFF', borderRadius: 2, marginRight: 6 }} />
                  <Text style={{ color: theme.text, fontSize: 12 }}>Iqlab</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 }}>
                  <View style={{ width: 12, height: 12, backgroundColor: '#FFB6C1', borderRadius: 2, marginRight: 6 }} />
                  <Text style={{ color: theme.text, fontSize: 12 }}>Ikhfa</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 }}>
                  <View style={{ width: 12, height: 12, backgroundColor: '#00C853', borderRadius: 2, marginRight: 6 }} />
                  <Text style={{ color: theme.text, fontSize: 12 }}>Idgham with Ghunnah</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 }}>
                  <View style={{ width: 12, height: 12, backgroundColor: '#DDA0DD', borderRadius: 2, marginRight: 6 }} />
                  <Text style={{ color: theme.text, fontSize: 12 }}>Ikhfa Shafawi</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 }}>
                  <View style={{ width: 12, height: 12, backgroundColor: '#AAAAAA', borderRadius: 2, marginRight: 6 }} />
                  <Text style={{ color: theme.text, fontSize: 12 }}>Silent Letters</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Save Changes - Slim floating bar */}
        {hasChanges && (
          <View style={{ height: 56 }} />
        )}

        {/* Reading Font Sizes - free-flow slider with live preview */}
        <View style={styles.section}>
          <View style={styles.sectionTitle}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Reading Font Sizes</Text>
          </View>

          <Text style={{ color: theme.inactive, fontSize: 11, marginBottom: 12, fontStyle: 'italic' }}>
            Tap anywhere on the slider to adjust size
          </Text>

          {/* Arabic text slider + preview */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ color: theme.text }}>Arabic</Text>
              <Text style={{ color: theme.inactive, fontSize: 12 }}>{Math.round(arabicSizePreview)}</Text>
            </View>
            <Slider
              value={arabicSizePreview}
              min={16}
              max={54}
              step={1}
              trackColor={theme.inactive}
              filledColor={theme.primary}
              thumbColor={theme.primary}
              onTouchStart={() => setIsSliderActive(true)}
              onTouchEnd={() => setIsSliderActive(false)}
              onChange={(v) => {
                // Update preview immediately for smooth UI
                setArabicSizePreview(v);
              }}
              onChangeEnd={(v) => {
                // Commit to store ONLY on release
                const rounded = Math.round(v);
                setArabicSizePreview(rounded); // Ensure preview matches store
                setFontSizeArabic(rounded);
              }}
            />
            {/* Live preview */}
            <View style={{ marginTop: 8, padding: 12, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <Text
                style={{
                  color: theme.text,
                  fontFamily: getArabicFontFamily(localArabicFont) || undefined,
                  ...getArabicTypographySizing(arabicSizePreview, localArabicFont as any),
                }}
              >
                بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ
              </Text>
            </View>
          </View>

          {/* Translation text slider + preview */}
          <View style={{ marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ color: theme.text }}>Translation</Text>
              <Text style={{ color: theme.inactive, fontSize: 12 }}>{Math.round(translationSizePreview)}</Text>
            </View>
            <Slider
              value={translationSizePreview}
              min={12}
              max={28}
              step={1}
              trackColor={theme.inactive}
              filledColor={theme.primary}
              thumbColor={theme.primary}
              onTouchStart={() => setIsSliderActive(true)}
              onTouchEnd={() => setIsSliderActive(false)}
              onChange={(v) => {
                setTranslationSizePreview(v);
              }}
              onChangeEnd={(v) => {
                const rounded = Math.round(v);
                setTranslationSizePreview(rounded);
                setFontSizeTranslation(rounded);
              }}
            />
            {/* Live preview */}
            <View style={{ marginTop: 8, padding: 12, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <Text
                style={{
                  color: theme.text,
                  fontSize: translationSizePreview,
                  lineHeight: Math.round(translationSizePreview * 1.5),
                }}
              >
                In the name of Allah, the Most Gracious, the Most Merciful.
              </Text>
            </View>
          </View>

          {/* Transliteration text slider + preview (last) */}
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ color: theme.text }}>Transliteration</Text>
              <Text style={{ color: theme.inactive, fontSize: 12 }}>{Math.round(translitSizePreview)}</Text>
            </View>
            <Slider
              value={translitSizePreview}
              min={12}
              max={26}
              step={1}
              trackColor={theme.inactive}
              filledColor={theme.primary}
              thumbColor={theme.primary}
              onTouchStart={() => setIsSliderActive(true)}
              onTouchEnd={() => setIsSliderActive(false)}
              onChange={(v) => {
                setTranslitSizePreview(v);
              }}
              onChangeEnd={(v) => {
                const rounded = Math.round(v);
                setTranslitSizePreview(rounded);
                setFontSizeTransliteration(rounded);
              }}
            />
            {/* Live preview */}
            <View style={{ marginTop: 8, padding: 12, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <Text
                style={{
                  color: theme.text,
                  fontSize: translitSizePreview,
                  lineHeight: Math.round(translitSizePreview * 1.35),
                }}
              >
                Bismillāhir Raḥmānir Raḥīm
              </Text>
            </View>
          </View>
        </View>

        {/* Notification Settings Card */}
        <NotificationSettingsCard />

        {/* FastingCalendar Settings Section (always active now) */}
        <View style={styles.section}>
          <View style={styles.sectionTitle}>
            <Calendar size={20} color={theme.primary} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Fasting Calendar</Text>
          </View>

          <Text style={[styles.feedbackText, { marginBottom: 16 }]}>Manage your Islamic fasting calendar notifications and settings.</Text>

          {/* Fasting Notifications Status (Global Master) */}
          <View style={styles.displayOption}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Bell size={16} color={'#FFFFFF'} style={{ marginRight: 8 }} />
              <Text style={[styles.displayOptionText, { color: theme.text }]}>Enable Fasting Notifications</Text>
            </View>
            <Pressable
              onPress={async () => {
                await fastingContext.updateSettings({
                  notifications: {
                    ...fastingContext.state.settings.notifications,
                    enabled: !fastingContext.state.settings.notifications.enabled
                  }
                });
              }}
            >
              <View style={[styles.toggleSwitch, { backgroundColor: fastingContext?.state.settings.notifications.enabled ? theme.primary : theme.inactive }]}>
                <View style={[styles.toggleThumb, { transform: [{ translateX: fastingContext?.state.settings.notifications.enabled ? 16 : 0 }], backgroundColor: '#FFFFFF' }]} />
              </View>
            </Pressable>
          </View>

          {/* Location Display - Interactive */}
          <Pressable
            style={[styles.displayOption, styles.interactiveOption]}
            onPress={() => setShowLocationSelector(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Globe size={16} color={'#FFFFFF'} style={{ marginRight: 8 }} />
              <Text style={[styles.displayOptionText, { color: theme.text }]}>Location</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.displayOptionText, { color: '#FFFFFF', fontSize: 12 }]}>
                {fastingContext.state.settings.location.city}, {fastingContext.state.settings.location.country}
              </Text>
              <Text style={[styles.displayOptionText, { color: theme.primary, fontSize: 12, marginLeft: 8 }]}>
                Change
              </Text>
            </View>
          </Pressable>

          {/* Navigate to full fasting settings */}
          <Pressable
            style={[styles.feedbackButton, { backgroundColor: theme.primary, marginTop: 16 }]}
            onPress={() => router.push('/fasting/settings')}
          >
            <Text style={styles.feedbackButtonText}>Manage Fasting Settings</Text>
          </Pressable>
        </View>

        {/* Feedback Section */}
        <View style={styles.section}>
          <View style={styles.sectionTitle}>
            <MessageSquare size={20} color={theme.primary} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Feedback & Support</Text>
          </View>

          <Text style={styles.feedbackText}>
            We value your feedback! Help us improve iHafidh by sharing your thoughts, suggestions, or reporting any issues.
          </Text>

          <Pressable style={styles.feedbackButton} onPress={sendFeedback}>
            <Text style={styles.feedbackButtonText}>Send Feedback</Text>
          </Pressable>

          <Text style={styles.feedbackText}>
            Please send your feedback and suggestions to:
            {'\n'}iHafidhapp@gmail.com
          </Text>
        </View>

        {/* App version label - Tap 7 times to access debug screen */}
        <Pressable
          style={styles.versionRow}
          onPress={() => {
            const newCount = debugTapCount + 1;
            setDebugTapCount(newCount);
            if (newCount >= 7) {
              setDebugTapCount(0);
              router.push('/push-debug');
            }
            // Reset counter after 2 seconds of inactivity
            setTimeout(() => setDebugTapCount(0), 2000);
          }}
        >
          <Text style={styles.versionText}>Ver-2.0.8</Text>
        </Pressable>
      </ScrollView>

      {/* Location Selector Modal */}
      {fastingContext && (
        <LocationSelector
          visible={showLocationSelector}
          onClose={() => setShowLocationSelector(false)}
          onLocationSelect={handleLocationChange}
          currentLocation={fastingContext.state.settings.location}
          theme={unifiedTheme.theme}
        />
      )}
    </View>
  );
}