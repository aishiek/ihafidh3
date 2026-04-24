import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Theme tokens (matches ReadModeScreen palette)
// ─────────────────────────────────────────────────────────────────────────────

const GOLD         = '#D4AF37';
const GOLD_DIM     = 'rgba(212,175,55,0.35)';
const GOLD_FAINT   = 'rgba(212,175,55,0.12)';
const PARCH_GOLD   = '#8B7355';
const PARCH_TRACK  = 'rgba(139,115,85,0.2)';
const DARK_BG      = 'rgba(5,8,15,0.96)';
const PARCH_BG     = 'rgba(245,242,233,0.97)';

// ─────────────────────────────────────────────────────────────────────────────
// 1. ReadingProgressBar
//    A 2px line directly under the header that fills left→right as you scroll.
//    Pass `progress` (0–1) derived from FlashList's onScroll event.
// ─────────────────────────────────────────────────────────────────────────────

interface ReadingProgressBarProps {
  progress: number;          // 0–1
  isParchmentLight: boolean;
}

export function ReadingProgressBar({ progress, isParchmentLight }: ReadingProgressBarProps) {
  const pct = `${Math.round(progress * 100)}%` as any;
  const trackColor  = isParchmentLight ? PARCH_TRACK : GOLD_FAINT;
  const fillColor   = isParchmentLight ? PARCH_GOLD  : GOLD;

  return (
    <View style={[styles.progressBarTrack, { backgroundColor: trackColor }]}>
      <View
        style={[
          styles.progressBarFill,
          { width: pct, backgroundColor: fillColor },
        ]}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. VerseProgressPill
//    Floating pill bottom-right showing "verse N / total".
//    Tap → opens a bottom-sheet jump navigator.
// ─────────────────────────────────────────────────────────────────────────────

interface VerseProgressPillProps {
  currentVerse: number;           // 1-based visible verse number
  totalVerses: number;            // total verses loaded
  isParchmentLight: boolean;
  /** Called with the 0-based FlashList index to scroll to */
  onJumpToVerse: (index: number) => void;
  /** Optional: surahId used to label the verse numbers (e.g. "15:64") */
  surahId?: number;
}

export function VerseProgressPill({
  currentVerse,
  totalVerses,
  isParchmentLight,
  onJumpToVerse,
  surahId,
}: VerseProgressPillProps) {
  const [showJumpSheet, setShowJumpSheet] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true, speed: 30 }).start();

  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  const pillBg     = isParchmentLight ? PARCH_BG  : DARK_BG;
  const pillBorder = isParchmentLight ? 'rgba(139,115,85,0.5)' : GOLD_DIM;
  const textColor  = isParchmentLight ? PARCH_GOLD : GOLD;

  // Percentage for the tiny arc on the pill
  const pct = totalVerses > 0 ? currentVerse / totalVerses : 0;

  return (
    <>
      {/* ── Floating Pill ── */}
      <Animated.View
        style={[
          styles.pillWrapper,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => setShowJumpSheet(true)}
          style={[
            styles.pill,
            { backgroundColor: pillBg, borderColor: pillBorder },
          ]}
        >
          {/* Mini arc progress ring */}
          <MiniRing progress={pct} color={textColor} />

          <View style={styles.pillTextBlock}>
            <Text style={[styles.pillCurrent, { color: textColor }]}>
              {currentVerse}
            </Text>
            <Text style={[styles.pillDivider, { color: textColor }]}>/</Text>
            <Text style={[styles.pillTotal, { color: textColor }]}>
              {totalVerses}
            </Text>
          </View>
        </Pressable>
      </Animated.View>

      {/* ── Jump Sheet ── */}
      <JumpSheet
        visible={showJumpSheet}
        totalVerses={totalVerses}
        currentVerse={currentVerse}
        surahId={surahId}
        isParchmentLight={isParchmentLight}
        onClose={() => setShowJumpSheet(false)}
        onSelect={(index) => {
          setShowJumpSheet(false);
          // Small delay so modal closes before scroll
          setTimeout(() => onJumpToVerse(index), 120);
        }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MiniRing — tiny SVG-like arc drawn with border tricks
// ─────────────────────────────────────────────────────────────────────────────

function MiniRing({ progress, color }: { progress: number; color: string }) {
  // Approximated with a small circular view + border trick
  // Full ring = 28px diameter, filled portion rotates a colored half-circle
  const SIZE = 22;
  const HALF = SIZE / 2;
  const deg  = Math.round(progress * 360);

  // We render the ring as a stack of two semicircles (classic CSS pie trick in RN)
  const leftDeg  = deg > 180 ? 180 : deg;
  const rightDeg = deg > 180 ? deg - 180 : 0;

  return (
    <View style={{ width: SIZE, height: SIZE, position: 'relative', marginRight: 6 }}>
      {/* Track */}
      <View style={[styles.ringTrack, {
        width: SIZE, height: SIZE, borderRadius: HALF,
        borderColor: `${color}22`,
      }]} />
      {/* Right half (first 0–180°) */}
      {rightDeg > 0 && (
        <View style={[styles.ringHalfClip, { width: HALF, height: SIZE, left: HALF }]}>
          <View style={[styles.ringHalf, {
            width: SIZE, height: SIZE, borderRadius: HALF,
            borderColor: color,
            transform: [{ rotate: `${rightDeg}deg` }],
          }]} />
        </View>
      )}
      {/* Left half (180–360°) */}
      {leftDeg > 0 && (
        <View style={[styles.ringHalfClip, { width: HALF, height: SIZE, left: 0 }]}>
          <View style={[styles.ringHalf, {
            width: SIZE, height: SIZE, borderRadius: HALF,
            borderColor: color,
            transform: [{ rotate: `${leftDeg - 180}deg` }],
          }]} />
        </View>
      )}
      {/* Percentage text in center */}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 6, color, fontWeight: '700' }}>
          {Math.round(progress * 100)}%
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JumpSheet — bottom modal with a flat verse list to jump to any verse
// ─────────────────────────────────────────────────────────────────────────────

interface JumpSheetProps {
  visible: boolean;
  totalVerses: number;
  currentVerse: number;
  surahId?: number;
  isParchmentLight: boolean;
  onClose: () => void;
  onSelect: (index: number) => void; // 0-based
}

function JumpSheet({
  visible,
  totalVerses,
  currentVerse,
  surahId,
  isParchmentLight,
  onClose,
  onSelect,
}: JumpSheetProps) {
  const sheetListRef = useRef<FlatList>(null);
  const sheetBg   = isParchmentLight ? '#F5F2E9' : '#0C0F18';
  const handleBg  = isParchmentLight ? '#D4C9B0' : '#2A2D3A';
  const textColor = isParchmentLight ? '#2B2519' : '#F4E4B7';
  const subColor  = isParchmentLight ? PARCH_GOLD : GOLD_DIM;
  const activeBg  = isParchmentLight ? 'rgba(139,115,85,0.15)' : 'rgba(212,175,55,0.1)';
  const activeColor = isParchmentLight ? PARCH_GOLD : GOLD;

  // Verse numbers array (1-based displayed, but we return 0-based index)
  const verseNumbers = Array.from({ length: totalVerses }, (_, i) => i + 1);

  // Auto-scroll to current verse when sheet opens
  const handleModalShow = useCallback(() => {
    if (currentVerse > 1 && sheetListRef.current) {
      setTimeout(() => {
        sheetListRef.current?.scrollToIndex({
          index: currentVerse - 1,
          animated: false,
          viewPosition: 0.3,
        });
      }, 80);
    }
  }, [currentVerse]);

  const renderItem = useCallback(({ item: vn }: { item: number }) => {
    const isActive = vn === currentVerse;
    return (
      <TouchableOpacity
        onPress={() => onSelect(vn - 1)}
        style={[
          styles.jumpItem,
          isActive && { backgroundColor: activeBg },
        ]}
        activeOpacity={0.65}
      >
        <View style={[
          styles.jumpNumberBadge,
          { borderColor: isActive ? activeColor : subColor },
        ]}>
          <Text style={[
            styles.jumpNumberText,
            { color: isActive ? activeColor : subColor },
          ]}>
            {surahId ? `${surahId}:${vn}` : vn}
          </Text>
        </View>
        {isActive && (
          <View style={[styles.jumpActiveDot, { backgroundColor: activeColor }]} />
        )}
      </TouchableOpacity>
    );
  }, [currentVerse, activeBg, activeColor, subColor, surahId, onSelect]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={handleModalShow}
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right', 'portrait']}
    >
      <Pressable style={styles.jumpBackdrop} onPress={onClose}>
        {/* Sheet — inner Pressable prevents backdrop tap from closing when touching sheet */}
        <Pressable
          style={[styles.jumpSheet, { backgroundColor: sheetBg }]}
          onPress={() => {}}
        >
          {/* Handle */}
          <View style={[styles.jumpHandle, { backgroundColor: handleBg }]} />

          {/* Title */}
          <Text style={[styles.jumpTitle, { color: textColor }]}>
            Jump to Verse
          </Text>
          <Text style={[styles.jumpSubtitle, { color: subColor }]}>
            {totalVerses} verses · currently at {currentVerse}
          </Text>

          {/* Verse grid */}
          <FlatList
            ref={sheetListRef}
            data={verseNumbers}
            keyExtractor={(item) => String(item)}
            renderItem={renderItem}
            numColumns={6}
            contentContainerStyle={styles.jumpGrid}
            showsVerticalScrollIndicator={false}
            initialNumToRender={300}
            onScrollToIndexFailed={(info) => {
              const wait = new Promise(resolve => setTimeout(resolve, 150));
              wait.then(() => {
                sheetListRef.current?.scrollToIndex({ index: info.index, animated: true });
              });
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const JUMP_ITEM_SIZE = 52;

const styles = StyleSheet.create({
  // ── Progress Bar ───────────────────────────────────────────────────────────
  progressBarTrack: {
    position: 'absolute',
    top: 52,        // height of header
    left: 0,
    right: 0,
    height: 2,
    zIndex: 20,
  },
  progressBarFill: {
    height: 2,
    borderRadius: 1,
  },

  // ── Verse Pill ─────────────────────────────────────────────────────────────
  pillWrapper: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    zIndex: 9999,
    elevation: 20,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 28,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
    gap: 4,
  },
  pillTextBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  pillCurrent: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  pillDivider: {
    fontSize: 11,
    opacity: 0.5,
    marginHorizontal: 1,
  },
  pillTotal: {
    fontSize: 11,
    opacity: 0.65,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },

  // ── Mini Ring ──────────────────────────────────────────────────────────────
  ringTrack: {
    position: 'absolute',
    top: 0, left: 0,
    borderWidth: 2,
  },
  ringHalfClip: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  ringHalf: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 2,
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },

  // ── Jump Sheet ─────────────────────────────────────────────────────────────
  jumpBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  jumpSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: '65%',
  },
  jumpHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  jumpTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 4,
  },
  jumpSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    opacity: 0.8,
  },
  jumpGrid: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  jumpItem: {
    width: JUMP_ITEM_SIZE,
    height: JUMP_ITEM_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    margin: 3,
    position: 'relative',
  },
  jumpNumberBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 4,
    minWidth: 40,
    alignItems: 'center',
  },
  jumpNumberText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  jumpActiveDot: {
    position: 'absolute',
    bottom: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
