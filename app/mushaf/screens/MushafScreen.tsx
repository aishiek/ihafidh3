import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MushafCard from '../components/MushafCard';
import { useMushafBookmarks } from '../hooks/useMushafBookmarks';
import { useMushafPagination } from '../hooks/useMushafPagination';

export default function MushafScreen() {
  const insets = useSafeAreaInsets();
  const { currentPage, nextPage, prevPage, goToPage } = useMushafPagination(1);
  const { bookmarks, toggleBookmark, saveLastRead, getLastRead } = useMushafBookmarks();
  const [mode, setMode] = useState<'image' | 'text'>('image');
  const router = useRouter();

  useEffect(() => {
    // Restore last read
    (async () => {
      try {
        const last = await getLastRead();
        if (last && last.page) {
          goToPage(last.page);
        }
        // ANALYTICS: Mushaf opened
        const {logAnalyticsEvent } = require('@/utils/analyticsHelper');
        logAnalyticsEvent('mushaf_opened', {
          page_number: last && last.page ? last.page : 1,});
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    // auto-save last read when page changes
    saveLastRead(currentPage);
  }, [currentPage]);

  const handleClose = () => {
    try {
      saveLastRead(currentPage);
    } catch (_) {}
    try {
      router.replace('/');
    } catch (e) {
      try { router.back(); } catch (_) {}
    }
  };

  return (
    <>
      <StatusBar style="light" backgroundColor="#1a1a2e" />
      <View style={[styles.container, { 
        paddingTop: Platform.OS === 'android' ? insets.top : 0,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }]}>
        <MushafCard />
      </View>
    </>
  );
}

const styles = StyleSheet.create({ container:{ flex:1, backgroundColor:'#1a1a2e' } });
