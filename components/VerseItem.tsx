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
import { getArabicFontFamily } from '@/utils/fontUtils';

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
  const { fontSizeArabic, fontSizeTransliteration, fontSizeTranslation, arabicFont, showTranslation, showTransliteration, repeatMode, setRepeatMode } = useSettingsStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioFallback, setAudioFallback] = useState(false);
  const [memorized, setMemorized] = useState(false);
  const [revised, setRevised] = useState(false);
  const [repeatCount, setRepeatCount] = useState(repeatMode || 1);
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  
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
  
  // Keep local repeatCount in sync with global repeatMode
  useEffect(() => {
    if (repeatMode && repeatMode !== repeatCount) {
      setRepeatCount(repeatMode);
    }
  }, [repeatMode]);
  
  const arabicFamily = getArabicFontFamily(arabicFont);

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
              lineHeight: fontSizeArabic * 1.8, // Improved line height
              color: '#FFFFFF',
              direction: 'rtl',
              fontFamily: arabicFamily,
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
              fontFamily: arabicFamily,
              // Avoid forcing fontWeight which can cause fallback; use font file's weight
              lineHeight: fontSizeArabic * 1.8,
              // Avoid letterSpacing on Arabic which can break shaping
              textAlign: 'right',
              paddingHorizontal: 4,
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
                      setRepeatMode(option);
                      setRepeatCount(option);
                      setShowRepeatModal(false);
                    }}
                  >
                    <Text style={styles.repeatOptionText}>{option}x</Text>
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
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  verseNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verseNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  verseInfo: {
    flex: 1,
    marginLeft: 8,
  },
  verseInfoText: {
    fontSize: 12,
    opacity: 0.8,
  },
  audioErrorText: {
    fontSize: 12,
    marginTop: 4,
  },
  audioFallbackText: {
    fontSize: 12,
    marginTop: 4,
  },
  audioButton: {
    padding: 8,
    borderRadius: 8,
  },
  repeatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  arabicText: {
    textAlignVertical: 'center',
  },
  transliterationText: {
    marginTop: 8,
  },
  translationText: {
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatModalContent: {
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 12,
    width: '80%',
  },
  repeatModalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  repeatOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  repeatOptionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    margin: 6,
  },
  repeatOptionButtonSelected: {
    backgroundColor: '#FFD70020',
    borderColor: '#FFD700',
  },
  repeatOptionText: {
    color: '#fff',
    fontSize: 14,
  },
});

export default memo(VerseItem);