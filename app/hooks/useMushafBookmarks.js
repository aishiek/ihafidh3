import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const MUSHAF_BOOKMARKS_KEY = '@mushaf:bookmarks';
const MUSHAF_LAST_READ_KEY = '@mushaf:lastRead';

/**
 * Hook to manage Mushaf bookmarks
 * Bookmarks are stored as a Set<number> of page numbers
 */
/**
 * Hook to manage Mushaf bookmarks
 * Bookmarks are stored as a Set of page numbers
 */
export function useMushafBookmarks() {
  const [bookmarks, setBookmarks] = useState(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  // Load bookmarks on mount
  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(MUSHAF_BOOKMARKS_KEY);
      if (stored) {
        const pages = JSON.parse(stored);
        setBookmarks(new Set(pages));
      }
      setIsLoaded(true);
    } catch (error) {
      console.error('Error loading mushaf bookmarks:', error);
      setIsLoaded(true);
    }
  }, []);
  const saveBookmarks = useCallback(async (newBookmarks) => {
    try {
      const pages = Array.from(newBookmarks);
      await AsyncStorage.setItem(MUSHAF_BOOKMARKS_KEY, JSON.stringify(pages));
      setBookmarks(newBookmarks);
    } catch (error) {
      console.error('Error saving mushaf bookmarks:', error);
    }
  }, []);

  /**
   * Toggle bookmark for a page
   * If page is bookmarked, remove it. Otherwise, add it.
   */
  const toggleBookmark = useCallback(
    (page) => {
      setBookmarks(prevBookmarks => {
        const newBookmarks = new Set(prevBookmarks);
        if (newBookmarks.has(page)) {
          newBookmarks.delete(page);
        } else {
          newBookmarks.add(page);
        }
        saveBookmarks(newBookmarks);
        return newBookmarks;
      });
    },
    [saveBookmarks]
  );

  /**
   * Add a bookmark for a page
   */
  const addBookmark = useCallback(
    (page) => {
      setBookmarks(prevBookmarks => {
        if (prevBookmarks.has(page)) {
          return prevBookmarks; // Already bookmarked
        }
        const newBookmarks = new Set(prevBookmarks);
        newBookmarks.add(page);
        saveBookmarks(newBookmarks);
        return newBookmarks;
      });
    },
    [saveBookmarks]
  );

  /**
   * Remove a bookmark for a page
   */
  const removeBookmark = useCallback(
    (page) => {
      setBookmarks(prevBookmarks => {
        if (!prevBookmarks.has(page)) {
          return prevBookmarks; // Not bookmarked
        }
        const newBookmarks = new Set(prevBookmarks);
        newBookmarks.delete(page);
        saveBookmarks(newBookmarks);
        return newBookmarks;
      });
    },
    [saveBookmarks]
  );

  /**
   * Check if a page is bookmarked
   */
  const isBookmarked = useCallback(
    (page) => {
      return bookmarks.has(page);
    },
    [bookmarks]
  );

  /**
   * Clear all bookmarks
   */
  const clearAllBookmarks = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(MUSHAF_BOOKMARKS_KEY);
      setBookmarks(new Set());
    } catch (error) {
      console.error('Error clearing mushaf bookmarks:', error);
    }
  }, []);

  /**
   * Save last read page and timestamp
   */
  const saveLastRead = useCallback(async (page) => {
    try {
      const data = {
        page,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(MUSHAF_LAST_READ_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving last read:', error);
    }
  }, []);

  /**
   * Get last read page
   */
  const getLastRead = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(MUSHAF_LAST_READ_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      return null;
    } catch (error) {
      console.error('Error getting last read:', error);
      return null;
    }
  }, []);

  return {
    bookmarks,
    isLoaded,
    toggleBookmark,
    addBookmark,
    removeBookmark,
    isBookmarked,
    clearAllBookmarks,
    saveLastRead,
    getLastRead,
    reloadBookmarks: loadBookmarks,
  };
}