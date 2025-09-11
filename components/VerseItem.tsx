import React, { useState, memo, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, Modal, TouchableOpacity, Platform } from 'react-native';
import { Play, Pause, BookOpen, Repeat } from 'lucide-react-native';
import { Verse } from '@/types';
import { useCustomColors } from '@/utils/themeUtils';
import { useThemeColor } from '@/utils/useThemeColor';
import { useSettingsStore } from '@/store/settingsStore';
import { useProgressStore } from '@/store/progressStore';
import { playAudio, pauseAudio, playVerseWithOptionalBismillah } from '@/utils/audioUtils';
import TajweedVerse from 'rn-tajweed-verse';

interface VerseItemProps {
  verse: Verse;
  isMemorized: () => boolean;
  isRevised: () => boolean;
  onMemorizeToggle: () => void;
  onRevisionToggle: () => void;
  onPlayAudio: () => void;
}

const VerseItem = ({ 
  verse, 
  isMemorized, 
  isRevised,
  onMemorizeToggle,
  onRevisionToggle,
  onPlayAudio,
}: VerseItemProps) => {
  const { primary } = useThemeColor();
  const { fontSizeArabic, fontSizeTransliteration, fontSizeTranslation, arabicFont, showTranslation, showTransliteration, repeatMode } = useSettingsStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioFallback, setAudioFallback] = useState(false);
  const [memorized, setMemorized] = useState(false);
  const [revised, setRevised] = useState(false);
  const [repeatCount, setRepeatCount] = useState(1);
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  
  // Helper function to get Arabic font family
  const getArabicFontFamily = () => {
    switch (arabicFont) {
      case 'scheherazade':
        return 'Scheherazade';
      case 'scheherazade-bold':
        return 'Scheherazade-Bold';
      case 'tajweed':
        return 'Scheherazade'; // Use Scheherazade for Tajweed mode
      case 'indo-pak':
        return 'NooreHuda';
      default:
        // For system default, provide fallback Arabic fonts that are commonly available
        // These fonts are typically available on most devices and provide good Arabic rendering
        return Platform.select({
          ios: 'Arial, Helvetica Neue, Helvetica', // iOS has good Arabic support with these fonts
          android: 'Roboto, Noto Sans Arabic, Arial', // Android's fonts with good Arabic support
          default: 'Arial, Helvetica, sans-serif' // Fallback for other platforms
        });
    }
  };
  
  // Update memorization and revision status when component mounts or verse changes
  useEffect(() => {
    setMemorized(isMemorized());
    setRevised(isRevised());
  }, [verse, isMemorized, isRevised]);
  
  // Use shared audio util to handle optional Bismillah + repeats

  const handlePlayAudio = async () => {
    try {
      setAudioError(null);
      setAudioFallback(false);
      
      if (isPlaying) {
        await pauseAudio();
        setIsPlaying(false);
      } else {
        await playVerseWithOptionalBismillah(verse, repeatCount, onStatus);
        // isPlaying flips true via callback once loaded
      }
    } catch (error) {
      console.error('Audio playback error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setAudioError(errorMessage);
      setIsPlaying(false);
    }
  };
  
  // Keep UI in sync with playback status
  const onStatus = (status: any) => {
    if (status?.isPlaying) {
      setIsPlaying(true);
      setAudioError(null); // Clear any previous errors
    }
    if (status?.isPaused || status?.didJustFinish === true || status?.playbackComplete) {
      setIsPlaying(false);
    }
    if (status?.error) {
      setIsPlaying(false);
      setAudioError(status.error);
      setAudioFallback(false);
    }
    if (status?.fallbackUsed) {
      setAudioFallback(true);
      setAudioError(null); // Clear error when fallback is used
    }
    if (status?.message && status?.fallbackUsed) {
      setAudioFallback(true);
    }
  };

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (isPlaying) {
        pauseAudio();
        setIsPlaying(false);
      }
    };
  }, [isPlaying]);
  
  const handleMarkMemorized = () => {
    onMemorizeToggle();
    setMemorized(isMemorized());
  };
  
  const handleMarkRevised = () => {
    onRevisionToggle();
    setRevised(isRevised());
  };
  
  const getBgColor = () => {
    if (memorized) return '#4CAF5020'; // Light green background with opacity
    return '#1a1a1a'; // Use dark background
  };
  
  const getBorderColor = () => {
    if (memorized) return '#4CAF50'; // Green for memorized
    return '#ffffff'; // White border
  };
  
  // Ensure we have valid content with fallbacks
  const arabicText = verse.arabicText && verse.arabicText.trim() !== '' 
    ? verse.arabicText 
    : 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
  
  const translation = verse.translation && verse.translation.trim() !== '' 
    ? verse.translation 
    : 'In the name of Allah, the Entirely Merciful, the Especially Merciful.';
  const transliteration = verse.transliteration && verse.transliteration.trim() !== ''
    ? verse.transliteration
    : undefined;
  
  const repeatOptions = [1, 2, 3, 4, 5, 7];
  
  return (
    <Pressable
      style={[
        styles.container,
        { 
          backgroundColor: getBgColor(), 
          borderColor: getBorderColor(),
          borderWidth: memorized ? 2 : 1
        }
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.verseNumber, { backgroundColor: primary }]}>
          <Text style={[styles.verseNumberText, { color: '#ffffff' }]}>
            {verse.verseNumber}
          </Text>
        </View>
        
        <View style={styles.verseInfo}>
          <Text style={[styles.verseInfoText, { color: '#ffffff' }]}>
            Juz {verse.juzNumber || 1} • Hizb {verse.hizbNumber || 1} • Page {verse.pageNumber || 1}
          </Text>
          {audioError && (
            <Text style={[styles.audioErrorText, { color: '#ff5252' }]}>
              {audioError}
            </Text>
          )}
          {audioFallback && (
            <Text style={[styles.audioFallbackText, { color: '#FFD700' }]}>
              Using fallback reciter (Alafasy)
            </Text>
          )}
        </View>
        
        <Pressable
          style={[styles.audioButton, { backgroundColor: primary }]}
          onPress={handlePlayAudio}
        >
          {isPlaying ? (
            <Pause size={16} color="#ffffff" />
          ) : (
            <Play size={16} color="#ffffff" />
          )}
        </Pressable>
        <TouchableOpacity
          style={[styles.repeatButton, { marginLeft: 8 }]}
          onPress={() => setShowRepeatModal(true)}
        >
          <Repeat size={18} color="#FFD700" />
          <Text style={{ color: '#FFD700', fontSize: 12, marginLeft: 2 }}>{repeatCount}x</Text>
        </TouchableOpacity>
      </View>
      
      {arabicFont === 'tajweed' && verse.tajweedText ? (
        <TajweedVerse
          verse={verse.tajweedText}
          config={{
            style: {
              fontSize: fontSizeArabic,
              lineHeight: fontSizeArabic * 1.5,
              color: '#FFFFFF',
              direction: 'rtl',
              fontFamily: getArabicFontFamily(), // Use the same font logic for consistency
            }
          }}
        />
      ) : (
        <Text 
          style={[
            styles.arabicText, 
            { 
              color: '#ffffff',
              fontSize: fontSizeArabic,
              fontFamily: getArabicFontFamily(),
              fontWeight: arabicFont === 'default' ? '400' : 'normal',
              // Add better line height for system fonts to improve readability
              lineHeight: arabicFont === 'default' ? fontSizeArabic * 1.8 : fontSizeArabic * 1.5,
            }
          ]}
        >
          {arabicText}
        </Text>
      )}

      {showTransliteration && transliteration && (
        <Text 
          style={[
            styles.transliterationText, 
            { 
              color: '#FFD700',
              fontSize: fontSizeTransliteration
            }
          ]}
        >
          {transliteration}
        </Text>
      )}
      
      {showTranslation && (
        <Text 
          style={[
            styles.translationText, 
            { 
              color: '#ffffff',
              fontSize: fontSizeTranslation
            }
          ]}
        >
          {translation}
        </Text>
      )}
      
      {/* Action Buttons - Always visible for easy access */}
      <View style={styles.actionsContainer}>
        <Pressable
          style={[
            styles.actionButton, 
            { 
              backgroundColor: memorized ? '#4CAF50' : '#000000',
              borderColor: memorized ? '#4CAF50' : '#ffffff',
              borderWidth: 1
            }
          ]}
          onPress={handleMarkMemorized}
        >
          <Text style={[
            styles.actionText,
            { color: memorized ? '#000000' : '#ffffff' }
          ]}>
            {memorized ? 'Unmark ❌' : 'Memorized'}
          </Text>
        </Pressable>
        
        <Pressable
          style={[
            styles.actionButton, 
            { 
              backgroundColor: revised ? '#FF9800' : '#000000',
              borderColor: revised ? '#FF9800' : '#ffffff',
              borderWidth: 1
            }
          ]}
          onPress={handleMarkRevised}
        >
          <Text style={[
            styles.actionText,
            { color: revised ? '#000000' : '#ffffff' }
          ]}>
            {revised ? 'Unmark ❌' : 'Revised'}
          </Text>
        </Pressable>
      </View>
      <Modal
        visible={showRepeatModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRepeatModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPressOut={() => setShowRepeatModal(false)}
        >
          <View style={styles.repeatModalContent}>
            <Text style={styles.repeatModalTitle}>Change Repeat Mode</Text>
            <View style={styles.repeatOptionsRow}>
              {repeatOptions
                .filter(option => option !== repeatCount) // Hide currently selected option
                .map(option => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.repeatOptionButton,
                      repeatCount === option && styles.repeatOptionButtonSelected
                    ]}
                    onPress={() => {
                      setRepeatCount(option);
                      setShowRepeatModal(false);
                    }}
                  >
                    <Text style={[
                      styles.repeatOptionText,
                      repeatCount === option && styles.repeatOptionTextSelected
                    ]}>{option}x</Text>
                  </TouchableOpacity>
                ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  verseNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verseNumberText: {
    fontSize: 14,
    fontWeight: '600',
  },
  verseInfo: {
    flex: 1,
    marginLeft: 12,
  },
  verseInfoText: {
    fontSize: 12,
  },
  audioErrorText: {
    fontSize: 10,
    marginTop: 4,
  },
  audioFallbackText: {
    fontSize: 10,
    marginTop: 4,
  },
  audioButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arabicText: {
    textAlign: 'right',
    lineHeight: 36,
    marginBottom: 12,
    fontWeight: '500',
  },
  translationText: {
    lineHeight: 24,
    marginBottom: 12,
  },
  transliterationText: {
    lineHeight: 22,
    marginBottom: 10,
  },
  actionsContainer: {
    flexDirection: 'row',
    marginTop: 8,
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
  },
  actionText: {
    marginLeft: 4,
    fontWeight: '500',
    fontSize: 12,
  },
  repeatButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatModalContent: {
    backgroundColor: '#232323',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    minWidth: 220,
  },
  repeatModalTitle: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  repeatOptionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  repeatOptionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#333',
    marginHorizontal: 4,
  },
  repeatOptionButtonSelected: {
    backgroundColor: '#FFD700',
  },
  repeatOptionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  repeatOptionTextSelected: {
    color: '#232323',
  },
});

// Memoize the component to prevent unnecessary re-renders
export default memo(VerseItem);