import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, Pressable, View, Dimensions, Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as ScreenOrientation from 'expo-screen-orientation';
import { usePathname } from 'expo-router';
import { RotateCw, X } from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * AutoRotateBanner
 * Displays a warm gold banner when the device is physically rotated to landscape
 * but the system auto-rotate lock is preventing the app from rotating.
 */
const BANNER_HEIGHT = 56;
const GOLD_COLOR = '#C9A84C';
const AUTO_DISMISS_MS = 5000;

export default function AutoRotateBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissedInSession, setIsDismissedInSession] = useState(false);
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [orientation, setOrientation] = useState<ScreenOrientation.Orientation>(ScreenOrientation.Orientation.PORTRAIT_UP);
  const autoDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Skip rendering on Mushaf/reading screen as requested
  // Mushaf screen is (tabs)/read (pathname "/read")
  // Read-mode is the golden font screen itself (pathname "/read-mode")
  const isMushafScreen = pathname === '/read' || pathname === '/read-mode';
  
  useEffect(() => {
    // Only subscribe if not already dismissed and not on Mushaf screen
    if (isDismissedInSession || isMushafScreen) {
      setIsVisible(false);
      return;
    }

    let lastX = 0;
    let lastY = 0;

    const subscription = Accelerometer.addListener(({ x, y }) => {
      // Sensitivity threshold
      const threshold = 0.7; // Approx 45 degrees
      
      // Determine physical orientation from gravity
      const isPhysicalLandscape = Math.abs(x) > threshold && Math.abs(y) < 0.4;
      
      // Check current app orientation
      ScreenOrientation.getOrientationAsync().then(appOrientation => {
        const isAppPortrait = 
          appOrientation === ScreenOrientation.Orientation.PORTRAIT_UP || 
          appOrientation === ScreenOrientation.Orientation.PORTRAIT_DOWN;

        if (isPhysicalLandscape && isAppPortrait) {
          if (!isVisible) {
            setIsVisible(true);
            // Auto-dismiss after 5 seconds
            if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
            autoDismissTimerRef.current = setTimeout(() => {
              setIsVisible(false);
            }, AUTO_DISMISS_MS);
          }
        } else if (!isPhysicalLandscape) {
          // If they rotate back to portrait, hide the banner
          setIsVisible(false);
        }
      });
    });

    Accelerometer.setUpdateInterval(500); // Check twice per second for better responsiveness

    return () => {
      subscription.remove();
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    };
  }, [isDismissedInSession, isMushafScreen, isVisible]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissedInSession(true);
    if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <MotiView
          from={{ translateY: -BANNER_HEIGHT - insets.top, opacity: 0 }}
          animate={{ translateY: insets.top + 8, opacity: 1 }}
          exit={{ translateY: -BANNER_HEIGHT - insets.top, opacity: 0 }}
          transition={{ type: 'timing', duration: 400 }}
          style={[styles.bannerContainer, { top: 0 }]}
        >
          <View style={styles.bannerContent}>
            <View style={styles.iconContainer}>
              <RotateCw size={20} color={GOLD_COLOR} />
            </View>
            
            <Text style={styles.bannerText}>
              Enable Auto-Rotate to unlock Golden Font
            </Text>

            <Pressable 
              onPress={handleDismiss} 
              hitSlop={15}
              style={styles.closeButton}
            >
              <X size={18} color="#94a3b8" />
            </Pressable>
          </View>
        </MotiView>
      )}
    </AnimatePresence>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    height: BANNER_HEIGHT,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: '100%',
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.3)', // Subtle gold border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(201, 168, 76, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bannerText: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});
