/**
 * Enhanced Hamburger Menu Component
 * Demonstrates unified theme and mixed state management approach
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import {
  Menu,
  X,
  Calendar,
  Moon,
  MapPin,
  Settings,
  Palette,
  Bell,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import { useContextAwareTheme, StateMigrationUtils } from '@/utils/stateManagementBridge';

interface MenuItem {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  feature: 'fasting' | 'quran' | 'general';
  onPress: () => void;
}

interface EnhancedHamburgerMenuProps {
  fastingContext?: any; // FastingCalendar context when available
}

export const EnhancedHamburgerMenu: React.FC<EnhancedHamburgerMenuProps> = ({
  fastingContext
}) => {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<'fasting' | 'quran' | 'general'>('general');

  // Use unified theme with automatic detection
  const { theme, isDark, setTheme, setColorScheme, raw } = useUnifiedTheme('auto', fastingContext);
  
  // Demonstrate feature-specific theming
  const fastingTheme = useContextAwareTheme('fasting', fastingContext);
  const quranTheme = useContextAwareTheme('quran');

  // Menu items with feature categorization
  const menuItems: MenuItem[] = [
    {
      id: 'fasting-calendar',
      title: 'Fasting Calendar',
      subtitle: fastingContext ? 'Using Context API' : 'Will use Context when integrated',
      icon: Calendar,
      color: fastingTheme.theme.primary,
      feature: 'fasting',
      onPress: () => {
        setSelectedFeature('fasting');
        setIsMenuVisible(false);
        router.push('/fasting/calendar');
      }
    },
    {
      id: 'qibla-finder',
      title: 'Qibla Finder',
      subtitle: 'Find prayer direction',
      icon: MapPin,
      color: '#dc2626',
      feature: 'general',
      onPress: () => {
        setSelectedFeature('general');
        setIsMenuVisible(false);
        router.push('/qibla');
      }
    },
    {
      id: 'moon-phases',
      title: 'Moon Phases',
      subtitle: 'Lunar calendar & phases',
      icon: Moon,
      color: '#6366f1',
      feature: 'fasting',
      onPress: () => {
        setSelectedFeature('fasting');
        setIsMenuVisible(false);
        router.push('/moon-phases');
      }
    }
  ];

  const handleThemeDemo = async () => {
    console.log('🎨 Theme Demo - Current state:');
    console.log('- Active theme source:', raw.context ? 'Context + Zustand' : 'Zustand only');
    console.log('- Current theme mode:', isDark ? 'Dark' : 'Light');
    console.log('- FastingCalendar context available:', !!fastingContext);

    // Demonstrate theme synchronization
    if (fastingContext) {
      try {
        await StateMigrationUtils.synchronizeThemeSettings(
          raw.zustand,
          raw.zustand,
          fastingContext
        );
        console.log('✅ Theme synchronization completed');
      } catch (error) {
        console.error('❌ Theme synchronization failed:', error);
      }
    }

    // Toggle theme to demonstrate unified updates
    setTheme(isDark ? 'light' : 'dark');
  };

  const handleColorSchemeDemo = (scheme: 'blue' | 'green' | 'purple' | 'orange') => {
    console.log(`🎨 Changing color scheme to: ${scheme}`);
    setColorScheme(scheme);
  };

  const styles = StyleSheet.create({
    hamburgerButton: {
      position: 'absolute',
      top: 50,
      right: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.surface,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
      zIndex: 1000,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    menuContainer: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 40,
      maxHeight: '80%',
    },
    menuHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
      paddingBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    menuTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
    },
    menuSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 2,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.surfaceElevated,
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      borderLeftWidth: 4,
    },
    menuIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    menuItemContent: {
      flex: 1,
    },
    menuItemTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    menuItemSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    themeDemo: {
      backgroundColor: theme.surfaceElevated,
      padding: 16,
      borderRadius: 12,
      marginTop: 20,
    },
    themeDemoTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    colorSchemeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    colorButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: theme.border,
    },
    statusInfo: {
      backgroundColor: theme.card,
      padding: 12,
      borderRadius: 8,
      marginTop: 8,
    },
    statusText: {
      fontSize: 12,
      color: theme.textMuted,
    },
  });

  return (
    <>
      {/* Hamburger Menu Button */}
      <TouchableOpacity
        style={styles.hamburgerButton}
        onPress={() => setIsMenuVisible(true)}
        activeOpacity={0.8}
      >
        <Menu size={24} color={theme.text} />
      </TouchableOpacity>

      {/* Menu Modal */}
      <Modal
        visible={isMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setIsMenuVisible(false)}
            activeOpacity={1}
          />
          
          <View style={styles.menuContainer}>
            {/* Header */}
            <View style={styles.menuHeader}>
              <View>
                <Text style={styles.menuTitle}>Features</Text>
                <Text style={styles.menuSubtitle}>
                  Mixed State Management • {fastingContext ? 'Context + Zustand' : 'Zustand Only'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsMenuVisible(false)}
              >
                <X size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Menu Items */}
              {menuItems.map((item) => {
                const isSelected = selectedFeature === item.feature;
                
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.menuItem,
                      { 
                        borderLeftColor: item.color,
                        backgroundColor: isSelected ? theme.surfaceElevated : theme.surface 
                      }
                    ]}
                    onPress={item.onPress}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.menuIconContainer,
                        { backgroundColor: item.color + '20' }
                      ]}
                    >
                      <item.icon size={24} color={item.color} />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={styles.menuItemTitle}>{item.title}</Text>
                      <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};
