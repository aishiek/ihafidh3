/**
 * Enhanced Hamburger Menu Component
 * Demonstrates unified theme and mixed state management approach
 */

// diagnostics entry removed for production build
import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import { useBookmarkStore } from '@/store/bookmarkStore';
import { StateMigrationUtils, useContextAwareTheme } from '@/utils/stateManagementBridge';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  Bookmark as BookmarkIcon,
  Calendar,
  MapPin,
  Menu,
  Moon,
  Sparkles,
  X
} from 'lucide-react-native';

import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useMushafBookmarks } from '../app/mushaf/hooks/useMushafBookmarks';

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
  inline?: boolean; // when true, render as headerRight button (no absolute positioning)
}

export const EnhancedHamburgerMenu: React.FC<EnhancedHamburgerMenuProps> = ({
  fastingContext,
  inline = false,
}) => {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<'fasting' | 'quran' | 'general'>('general');
  // Use a stable selector to avoid re-renders from new array instances
  const appBookmarksCount = useBookmarkStore(state => state.bookmarks.length);
  // Mushaf bookmarks (stored separately in AsyncStorage)
  const { bookmarks: mushafBookmarks } = useMushafBookmarks();
  const mushafBookmarksCount = mushafBookmarks ? (mushafBookmarks.size || 0) : 0;
  const bookmarksCount = appBookmarksCount + mushafBookmarksCount;

  // Use unified theme with automatic detection
  const { theme, isDark, setTheme, setColorScheme, raw } = useUnifiedTheme('auto', fastingContext);

  // Demonstrate feature-specific theming
  const fastingTheme = useContextAwareTheme('fasting', fastingContext);
  const quranTheme = useContextAwareTheme('quran');

  // Menu items with feature categorization
  const menuItems: MenuItem[] = [
    {
      id: 'fasting-calendar',
      title: 'Sunnah Fastings...',
      subtitle: 'Fast and Purify Your Soul',
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
      id: 'quranic-duas',
      title: 'Quranic Duas',
      subtitle: 'Supplications from the Quran',
      icon: Sparkles,
      color: '#D4AF37',
      feature: 'quran',
      onPress: () => {
        setSelectedFeature('quran');
        setIsMenuVisible(false);
        router.push('/(tabs)/duas');
      }
    },
    {
      id: 'bookmarks',
      title: 'Bookmarks',
      subtitle: 'Your saved verses',
      icon: BookmarkIcon,
      color: '#9C27B0',
      feature: 'quran',
      onPress: async () => {
        try { await Haptics.selectionAsync(); } catch { }
        setSelectedFeature('quran');
        setIsMenuVisible(false);
        router.push('/bookmarks');
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
    ,
    // diagnostics menu intentionally removed
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
      top: 12,
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
    inlineButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.surface,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
      marginRight: 8,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
      paddingTop: 64, // leave room for status/header; keep simple without additional deps
      paddingHorizontal: 8,
    },
    menuContainer: {
      backgroundColor: theme.background,
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 16,
      width: '92%',
      maxHeight: '80%',
      zIndex: 2,
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
      position: 'relative',
    },
    menuIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.2)',
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
    badge: {
      position: 'absolute',
      top: 10,
      right: 10,
      backgroundColor: '#FFD700',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    badgeText: {
      color: '#1a1a1a',
      fontSize: 12,
      fontWeight: '700',
    },
  });

  return (
    <>
      {/* Hamburger Menu Button */}
      <TouchableOpacity
        style={inline ? styles.inlineButton : styles.hamburgerButton}
        onPress={() => setIsMenuVisible(true)}
        activeOpacity={0.8}
      >
        <Menu size={24} color={theme.text} />
      </TouchableOpacity>

      {/* Menu Modal */}
      <Modal
        visible={isMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.menuContainer}>
            {/* Header */}
            <View style={styles.menuHeader}>
              <View>
                <Text style={styles.menuTitle}>Essentials</Text>
                <Text style={styles.menuSubtitle}>
                  Tools to enhance your Spiritual Journey!
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsMenuVisible(false)}
              >
                <X size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
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
                        { backgroundColor: item.id === 'bookmarks' ? '#9C27B0' : item.color + '20' }
                      ]}
                    >
                      <item.icon size={item.id === 'bookmarks' ? 32 : 24} color={item.id === 'bookmarks' ? '#FFFFFF' : item.color} />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={styles.menuItemTitle}>{item.title}</Text>
                      <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                    </View>
                    {item.id === 'bookmarks' && (appBookmarksCount > 0 || mushafBookmarksCount > 0) && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {appBookmarksCount > 0 && (appBookmarksCount > 99 ? '99+' : String(appBookmarksCount))}
                          {appBookmarksCount > 0 && mushafBookmarksCount > 0 && ' + '}
                          {mushafBookmarksCount > 0 && (mushafBookmarksCount > 99 ? '99+' : String(mushafBookmarksCount))}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Backdrop area to dismiss (fills remaining space) */}
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setIsMenuVisible(false)}
            activeOpacity={1}
          />
        </View>
      </Modal>
    </>
  );
};
