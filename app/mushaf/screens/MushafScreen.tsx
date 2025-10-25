import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MushafCard from '../components/MushafCard';
import { useMushafBookmarks } from '../hooks/useMushafBookmarks';
import { useMushafPagination } from '../hooks/useMushafPagination';

export default function MushafScreen(){
  const { currentPage, nextPage, prevPage, goToPage } = useMushafPagination(1);
  const { bookmarks, toggleBookmark, saveLastRead, getLastRead } = useMushafBookmarks();
  const [mode, setMode] = useState<'image'|'text'>('image');

  useEffect(() => {
    // Restore last read
    (async () => {
      try {
        const last = await getLastRead();
        if (last && last.page) {
          goToPage(last.page);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    // auto-save last read when page changes
    saveLastRead(currentPage);
  }, [currentPage]);


  const router = useRouter();

  const handleClose = () => {
    // last read is saved on page change; ensure final save and go back
    try { saveLastRead(currentPage); } catch (_) {}
    // Ensure we return to the app home (replace so we don't leave a broken history entry)
    try {
      router.replace('/');
    } catch (e) {
      // Fallback to back if replace is not available for some reason
      try { router.back(); } catch (_) { /* ignore */ }
    }
  };

  return (
    <View style={styles.container}>
        <MushafCard />
    </View>
  );
}

const styles = StyleSheet.create({ container:{ flex:1, backgroundColor:'#1a1a2e' } });
