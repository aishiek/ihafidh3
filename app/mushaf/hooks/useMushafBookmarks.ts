import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'mushaf:bookmarks';

export function useMushafBookmarks() {
  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());

  useEffect(() => {
    (async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const arr = JSON.parse(raw) as number[];
          setBookmarks(new Set(arr));
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const toggleBookmark = useCallback(async (page: number) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page); else next.add(page);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next))).catch(() => {});
      return next;
    });
  }, []);

  return { bookmarks, toggleBookmark };
}
