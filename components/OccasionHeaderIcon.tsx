import { OccasionData, OccasionService } from '@/services/OccasionService';
import { OCCASION_NAMES } from '@/utils/occasionUtils';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Dynamic header icon showing current Islamic occasion
 * Features:
 * - Beautiful tooltip modal on press (not navigation)
 * - Smooth fade-in animation
 * - Proper touch target size
 * - Stunning visual design with gradients
 * - User immediately knows what it represents
 */
export default function OccasionHeaderIcon() {
  const [occasionData, setOccasionData] = useState<OccasionData | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await OccasionService.getActiveOccasion();

        if (mounted && data) {
          setOccasionData(data);

          // Smooth fade-in + scale animation
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
              toValue: 1,
              friction: 8,
              tension: 40,
              useNativeDriver: true,
            }),
          ]).start();
        }
      } catch (error) {
        console.error('[OccasionHeaderIcon] Load failed:', error);
        if (mounted) {
          setOccasionData(null);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [fadeAnim, scaleAnim]);

  // Don't render anything if no active occasion
  if (!occasionData) return null;
  const displayName = occasionData.displayName || OCCASION_NAMES[occasionData.id] || occasionData.id;
  const shortName = occasionData.id.replace(/([A-Z])/g, ' $1').trim(); // "EidUlFitr" -> "Eid Ul Fitr"

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setShowTooltip(true);
  };

  const getGradientColors = (): readonly [string, string] => {
    switch (occasionData.id) {
      case 'Ramadan':
        return ['#1a237e', '#4a148c'] as const; // Deep blue to purple
      case 'EidUlFitr':
      case 'EidUlAdha':
        return ['#1b5e20', '#2e7d32'] as const; // Green
      case 'Hajj':
        return ['#4a148c', '#7b1fa2'] as const; // Purple
      case 'Arafah':
        return ['#bf360c', '#d84315'] as const; // Deep orange
      case 'Muharram':
        return ['#311b92', '#4527a0'] as const; // Deep purple
      case 'MiladUnNabi':
        return ['#00695c', '#00897b'] as const; // Teal
      default:
        return ['#1f2937', '#374151'] as const; // Dark gray
    }
  };

  const getEmoji = (): string => {
    switch (occasionData.id) {
      case 'Ramadan':
        return '🌙';
      case 'EidUlFitr':
        return '🕌';
      case 'EidUlAdha':
        return '🐑';
      case 'Hajj':
        return '🕋';
      case 'Arafah':
        return '⛰️';
      case 'Muharram':
        return '📿';
      case 'MiladUnNabi':
        return '🌟';
      default:
        return '☪️';
    }
  };

  return (
    <>
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
      }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${displayName} - Tap to learn more`}
          accessibilityHint="Shows details about the current Islamic occasion"
          onPress={handlePress}
          style={({ pressed }) => [
            styles.container,
            pressed && styles.containerPressed
          ]}
        >
          {/* Simple emoji icon - works great on both Android and iOS */}
          <Text style={styles.emojiIcon}>{getEmoji()}</Text>
        </Pressable>
      </Animated.View>

      {/* Beautiful Tooltip Modal */}
      <Modal
        visible={showTooltip}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowTooltip(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowTooltip(false)}
        >
          <Pressable
            style={styles.tooltipContainer}
            onPress={(e) => e.stopPropagation()}
          >
            <LinearGradient
              colors={getGradientColors()}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tooltipGradient}
            >
              {/* Header with single emoji */}
              <View style={styles.tooltipHeader}>
                <View style={styles.tooltipIconContainer}>
                  <Text style={styles.tooltipMainEmoji}>{getEmoji()}</Text>
                </View>
              </View>

              {/* Title from remote */}
              <Text style={styles.tooltipTitle}>{displayName}</Text>

              {/* Decorative line */}
              <View style={styles.decorativeLine} />

              {/* Message from remote */}
              <Text style={styles.tooltipMessage}>
                {occasionData.description || `Blessed ${shortName}! May Allah accept your worship and good deeds during this special time.`}
              </Text>

              {/* Close hint */}
              <Text style={styles.tooltipHint}>Tap anywhere to close</Text>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  containerPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.9 }],
  },
  emojiIcon: {
    fontSize: 24,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  tooltipContainer: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    overflow: 'hidden',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  tooltipGradient: {
    padding: 24,
    alignItems: 'center',
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 16,
  },
  tooltipIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  tooltipMainEmoji: {
    fontSize: 36,
    textAlign: 'center',
  },
  tooltipTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  decorativeLine: {
    width: 50,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 2,
    marginBottom: 16,
  },
  tooltipMessage: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  tooltipHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
});
