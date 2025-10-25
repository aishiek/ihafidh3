import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'mushaf:bookmarks';
const LAST_READ_KEY = 'mushaf:last_read';

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

  const persist = useCallback(async (next: Set<number>) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
    } catch (e) {
      // ignore persist errors
    }
  }, []);

  const reload = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) setBookmarks(new Set(JSON.parse(raw) as number[]));
      else setBookmarks(new Set());
    } catch (e) {
      setBookmarks(new Set());
    }
  }, []);

  const clearBookmarks = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setBookmarks(new Set());
    } catch (e) {
      // ignore
    }
  }, []);

  const toggleBookmark = useCallback((page: number) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page); else next.add(page);
      persist(next);
      return next;
    });
  }, [persist]);

  const saveLastRead = useCallback(async (page: number) => {
    try {
      const payload = { page, timestamp: Date.now() };
      await AsyncStorage.setItem(LAST_READ_KEY, JSON.stringify(payload));
    } catch (e) {
      // ignore
    }
  }, []);

  const getLastRead = useCallback(async (): Promise<{ page: number; timestamp: number } | null> => {
    try {
      const raw = await AsyncStorage.getItem(LAST_READ_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }, []);

  return { bookmarks, toggleBookmark, saveLastRead, getLastRead, reload, clearBookmarks };
}
