import * as Haptics from 'expo-haptics';
import { ArrowLeft, Bookmark, BookOpen, Home } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MushafHeader({ pageNumber, totalPages, isBookmarked, onBookmarkToggle, onClose, onHome, onChangeLayout }:{
  pageNumber?:number;
  totalPages?:number;
  isBookmarked:boolean;
  onBookmarkToggle:()=>void;
  onClose:()=>void;
  onChangeLayout?: ()=>void;
  onHome?: ()=>void;
}){
  // Minimal header: back (left), home (center), bookmark (right)
  const pressWithHaptic = async (fn?: () => void) => {
    try { await Haptics.selectionAsync(); } catch (_) {}
    try { fn?.(); } catch (_) {}
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.slimHeader}>
        <View style={styles.leftContainer}>
          <Pressable onPress={onClose} style={[styles.icon, styles.leftIcon]} accessibilityLabel="Back">
            <ArrowLeft color="#fff" />
          </Pressable>
        </View>

        <View style={styles.centerContainer}>
          <Text style={styles.title}>Mushaf Mode</Text>
        </View>

        <View style={styles.rightContainer}>
          <Pressable onPress={() => pressWithHaptic(onChangeLayout)} style={[styles.icon]} accessibilityLabel="Change layout">
            <BookOpen color="#fff" />
          </Pressable>
          <Pressable onPress={() => pressWithHaptic(onBookmarkToggle)} style={[styles.icon]} accessibilityLabel="Bookmark" accessibilityState={{ selected: !!isBookmarked }}>
            <Bookmark color={isBookmarked ? '#FFD166' : '#fff'} />
          </Pressable>
          <Pressable onPress={() => onHome && pressWithHaptic(onHome)} style={[styles.icon]} accessibilityLabel="Home">
            <Home color="#fff" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    backgroundColor: '#0F172A' 
  },
  slimHeader: {
    height: 48,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  leftContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerContainer: {
    flex: 2,
    alignItems: 'center',
  },
  rightContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  icon: { 
    width: 40, 
    height: 40, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderRadius: 20,
  },
  leftIcon: { 
    marginLeft: 4,
  },
  rightIcon: { 
    marginLeft: 8,
  },
  title: { 
    color: '#fff', 
    fontWeight: '600', 
    fontSize: 16,
    textAlign: 'center',
  },
  rightIconsRow: {
    flexDirection: 'row',
  },
  navBtn: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 6, 
    borderWidth: 1, 
    borderColor: '#FFD166', 
    marginHorizontal: 6 
  },
  navText: { 
    color: '#FFD166', 
    fontWeight: '700' 
  },
  navBtnDisabled: { 
    opacity: 0.45, 
    borderColor: 'rgba(255,209,102,0.25)' 
  },
  modeBtn: { 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6, 
    borderWidth: 1, 
    borderColor: '#FFD166' 
  },
  modeActive: { 
    backgroundColor: '#FFD166' 
  },
  modeText: { 
    color: '#FFD166' 
  },
  modeTextActive: { 
    color: '#1a1a2e', 
    fontWeight: '700' 
  },
  jumpWrap: { 
    flexDirection: 'row-reverse', 
    alignItems: 'center', 
    marginLeft: 8 
  },
  jumpInput: { 
    width: 80, 
    height: 34, 
    color: '#fff', 
    borderWidth: 1, 
    borderColor: 'rgba(255,209,102,0.12)', 
    paddingHorizontal: 8, 
    borderRadius: 6, 
    textAlign: 'center' 
  },
  jumpBtn: { 
    paddingHorizontal: 8, 
    paddingVertical: 6, 
    backgroundColor: '#FFD166', 
    borderRadius: 6, 
    marginLeft: 6 
  },
  jumpBtnText: { 
    color: '#1a1a2e', 
    fontWeight: '700' 
  },
  rightIcons: { 
    width: 48, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  rightIconsRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'flex-end', 
    minWidth: 80 
  },
  surahBtn: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 6, 
    borderWidth: 1, 
    borderColor: '#FFD166', 
    marginLeft: 8, 
    backgroundColor: 'transparent' 
  },
  surahText: { 
    color: '#FFD166', 
    fontWeight: '700' 
  }
});

