import { useThemeStore } from '@/store/themeStore';
import { useCustomColors } from '@/utils/themeUtils';
import { useThemeColor } from '@/utils/useThemeColor';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Bookmark, Moon, Settings, Sun } from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface MushafHeaderProps {
  isBookmarked: boolean;
  onBookmarkToggle: () => void;
  onClose: () => void;
  onHome: () => void;
  onChangeLayout: () => void;
  surahName?: string | null;
  juzNumber?: number | null;
}

export default function MushafHeader({
  isBookmarked,
  onBookmarkToggle,
  onClose,
  onHome,
  onChangeLayout,
  surahName,
  juzNumber,
}: MushafHeaderProps) {
  const { primary } = useThemeColor();
  const [bookmarkAnimating, setBookmarkAnimating] = useState(false);
  const { themeMode, setThemeMode } = useThemeStore();
  const colors = useCustomColors();
  const isDark = themeMode === 'dark';

  const handleBookmarkPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setBookmarkAnimating(true);
    onBookmarkToggle();
    setTimeout(() => setBookmarkAnimating(false), 300);
  };

  return (
    <View style={[styles.header, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff', borderBottomColor: isDark ? '#FFD60A20' : '#e0e0e0' }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onClose} style={styles.headerButton} hitSlop={8}>
          <ArrowLeft size={24} color={isDark ? "#FFD60A" : "#333333"} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          {surahName || juzNumber ? (
            <View style={styles.infoContainer}>
              {surahName && (
                <Text
                  style={[styles.surahName, { color: isDark ? '#FFD60A' : colors.primary }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {surahName}
                </Text>
              )}
              {juzNumber && (
                <Text style={[styles.juzText, { color: isDark ? '#999' : '#666' }]}>
                  Juz {juzNumber}
                </Text>
              )}
            </View>
          ) : (
            <Text
              style={[styles.headerTitle, { color: isDark ? '#FFD60A' : colors.primary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Mushaf Reader
            </Text>
          )}
        </View>

        <View style={styles.headerButtonsRight}>
          <TouchableOpacity
            onPress={handleBookmarkPress}
            style={[
              styles.headerButton,
              bookmarkAnimating && styles.bookmarkAnimating,
            ]}
            hitSlop={8}
          >
            <Bookmark
              size={24}
              color={isBookmarked ? (isDark ? '#FFD60A' : colors.primary) : (isDark ? '#666' : '#999')}
              fill={isBookmarked ? (isDark ? '#FFD60A' : colors.primary) : 'none'}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={onChangeLayout} style={styles.headerButton} hitSlop={8}>
            <Settings size={24} color={isDark ? "#FFD60A" : colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
              setThemeMode(isDark ? 'light' : 'dark');
            }}
            style={styles.headerButton}
            hitSlop={8}
          >
            {isDark ? (
              <Sun size={24} color="#FFD60A" />
            ) : (
              <Moon size={24} color={colors.primary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onHome} style={styles.headerButton} hitSlop={8}>
            <Text style={[styles.homeButtonText, { color: isDark ? '#FFD60A' : colors.primary }]}>Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkAnimating: {
    transform: [{ scale: 0.9 }],
  },
  headerButtonsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  homeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  surahName: {
    fontSize: 16,
    fontWeight: '700',
  },
  juzText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
});