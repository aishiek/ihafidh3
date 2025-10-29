import { useThemeColor } from '@/utils/useThemeColor';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Bookmark, Settings } from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface MushafHeaderProps {
  isBookmarked: boolean;
  onBookmarkToggle: () => void;
  onClose: () => void;
  onHome: () => void;
  onChangeLayout: () => void;
}

export default function MushafHeader({
  isBookmarked,
  onBookmarkToggle,
  onClose,
  onHome,
  onChangeLayout,
}: MushafHeaderProps) {
  const { primary } = useThemeColor();
  const [bookmarkAnimating, setBookmarkAnimating] = useState(false);

  const handleBookmarkPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBookmarkAnimating(true);
    onBookmarkToggle();
    setTimeout(() => setBookmarkAnimating(false), 300);
  };

  return (
    <View style={[styles.header, { backgroundColor: '#1a1a1a', borderBottomColor: '#FFD60A20' }]}> 
      <View style={styles.headerRow}> 
        <TouchableOpacity onPress={onClose} style={styles.headerButton} hitSlop={8}> 
          <ArrowLeft size={24} color="#FFD60A" /> 
        </TouchableOpacity>

        <View style={styles.headerCenter}> 
          <Text style={[styles.headerTitle, { color: '#FFD60A' }]}>Mushaf Reader</Text> 
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
              color={isBookmarked ? '#FFD60A' : '#666'}
              fill={isBookmarked ? '#FFD60A' : 'none'}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={onChangeLayout} style={styles.headerButton} hitSlop={8}>
            <Settings size={24} color="#FFD60A" />
          </TouchableOpacity>

          <TouchableOpacity onPress={onHome} style={styles.headerButton} hitSlop={8}>
            <Text style={[styles.homeButtonText, { color: '#FFD60A' }]}>Home</Text>
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
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  homeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});