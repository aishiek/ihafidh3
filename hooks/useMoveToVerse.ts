import { useCallback, useRef } from 'react';
import type { ScrollView } from 'react-native';

/**
 * Hook to manage refs for verses inside a ScrollView and jump to a verse instantly.
 * - scrollViewRef: attach to the ScrollView component
 * - setVerseRef: attach to each verse container with its verseNumber
 * - moveToVerse: instantly move the scroll view to the verse (no animation)
 */
export const useMoveToVerse = () => {
  const scrollViewRef = useRef<ScrollView | null>(null);
  const verseRefsMap = useRef<Record<number, any>>({});

  // Store ref for each verse
  const setVerseRef = useCallback((verseNumber: number, ref: any) => {
    if (ref) {
      verseRefsMap.current[verseNumber] = ref;
    }
  }, []);

  // Move to verse without scroll animation (instant)
  const moveToVerse = useCallback((verseNumber: number) => {
    const verseRef = verseRefsMap.current[verseNumber];
    if (!verseRef || !scrollViewRef.current) {
      console.warn(`[moveToVerse] Verse ${verseNumber} ref not found`);
      return false;
    }

    try {
      // measureLayout expects a native node or a ref; using the verse ref
      // NOTE: types are loosened here to avoid platform-specific typing issues
      verseRef.measureLayout(
        // relativeToNativeNode: try passing the ScrollView ref's inner handle if available
        (scrollViewRef as any).current,
        (x: number, y: number, width: number, height: number) => {
          // Move instantly without animation
          (scrollViewRef.current as any)?.scrollTo({
            y: Math.max(0, y - 16), // small padding from top
            animated: false,
          });
        },
        (error: any) => {
          console.warn(`[moveToVerse] Measure failed for verse ${verseNumber}:`, error);
          return false;
        }
      );
      return true;
    } catch (error) {
      console.error(`[moveToVerse] Error moving to verse ${verseNumber}:`, error);
      return false;
    }
  }, []);

  // Clear all refs (optional cleanup)
  const clearRefs = useCallback(() => {
    verseRefsMap.current = {};
  }, []);

  return {
    scrollViewRef,
    setVerseRef,
    moveToVerse,
    clearRefs,
  } as const;
};

export default useMoveToVerse;
