import { useFastingCalendar } from '@/components/fasting/context/FastingCalendarContext';
import LocationSelector from '@/components/LocationSelector';
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
import { router, Stack } from 'expo-router';
import { Bell, Calendar, Globe, MessageSquare, Music, User } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const USER_NAME_KEY = 'user_name';

export default function SettingsScreen() {
  const { theme, colorScheme, setColorScheme } = useThemeStore();
  const { userName, translationLanguage, reciterIdentifier, showTranslation, showTransliteration, fontSizeArabic, fontSizeTransliteration, fontSizeTranslation, arabicFont, setUserName, setTranslationLanguage, setReciterIdentifier, setShowTranslation, setShowTransliteration, setFontSizeArabic, setFontSizeTransliteration, setFontSizeTranslation, setArabicFont } = useSettingsStore();
  
  // Mixed state management integration
  const unifiedTheme = useUnifiedTheme();
  const fastingContext = useFastingCalendar();
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
      
      // Update both Zustand store and AsyncStorage
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
    
    Linking.canOpenURL(mailtoUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(mailtoUrl);
        } else {
          // Fallback: show the email address
          Alert.alert(
            'Send Feedback',
            'Please send your feedback and suggestions to:\n\niHafidhapp@gmail.com',
            [
              { text: 'Copy Email', onPress: () => {
                // Note: Clipboard would need to be imported for this to work
                Alert.alert('Email Address', 'iHafidhapp@gmail.com');
              }},
              { text: 'OK' }
            ]
          );
        }
      })
      .catch((err) => {
        console.error('Error opening email:', err);
        Alert.alert(
          'Send Feedback',
          'Please send your feedback and suggestions to:\n\niHafidhapp@gmail.com',
          [{ text: 'OK' }]
        );
      });
  };

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
            borderRadius: 24,
            paddingVertical: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 3,
          }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Save changes</Text>
          </Pressable>
        </View>
      )}

      <Stack.Screen
        options={{
          title: 'Settings',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
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
              { value: 'indo-pak', label: 'Indo-Pak (Noore Huda)' }
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
                  <View style={{ width: 12, height: 12, backgroundColor: '#FF7E1E', borderRadius: 2, marginRight: 6 }} />
                  <Text style={{ color: theme.text, fontSize: 12 }}>Ghunnah</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 }}>
                  <View style={{ width: 12, height: 12, backgroundColor: '#DD0008', borderRadius: 2, marginRight: 6 }} />
                  <Text style={{ color: theme.text, fontSize: 12 }}>Qalqalah</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 }}>
                  <View style={{ width: 12, height: 12, backgroundColor: '#A1A1A1', borderRadius: 2, marginRight: 6 }} />
                  <Text style={{ color: theme.text, fontSize: 12 }}>Noon/Meem Mushaddad</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 }}>
                  <View style={{ width: 12, height: 12, backgroundColor: '#58B800', borderRadius: 2, marginRight: 6 }} />
                  <Text style={{ color: theme.text, fontSize: 12 }}>Idgham</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 }}>
                  <View style={{ width: 12, height: 12, backgroundColor: '#FFD700', borderRadius: 2, marginRight: 6 }} />
                  <Text style={{ color: theme.text, fontSize: 12 }}>Madd</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 }}>
                  <View style={{ width: 12, height: 12, backgroundColor: '#26BFFD', borderRadius: 2, marginRight: 6 }} />
                  <Text style={{ color: theme.text, fontSize: 12 }}>Iqlab</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 }}>
                  <View style={{ width: 12, height: 12, backgroundColor: '#9400A8', borderRadius: 2, marginRight: 6 }} />
                  <Text style={{ color: theme.text, fontSize: 12 }}>Ikhfa</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 }}>
                  <View style={{ width: 12, height: 12, backgroundColor: '#169777', borderRadius: 2, marginRight: 6 }} />
                  <Text style={{ color: theme.text, fontSize: 12 }}>Idgham with Ghunnah</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 }}>
                  <View style={{ width: 12, height: 12, backgroundColor: '#D500B7', borderRadius: 2, marginRight: 6 }} />
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
          <View style={{ height: 72 }} />
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
              <View style={[styles.toggleSwitch,{ backgroundColor: fastingContext?.state.settings.notifications.enabled ? theme.primary : theme.inactive }]}>
                <View style={[styles.toggleThumb,{ transform: [{ translateX: fastingContext?.state.settings.notifications.enabled ? 16 : 0 }], backgroundColor: '#FFFFFF' }]} />
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

        {/* App version label */}
        <View style={styles.versionRow}>
          <Text style={styles.versionText}>Ver-1.2.1</Text>
        </View>
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