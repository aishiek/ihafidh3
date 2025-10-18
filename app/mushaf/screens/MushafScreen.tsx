import React from 'react';
import { View, StyleSheet } from 'react-native';
import MushafCard from '../components/MushafCard';
import { useMushafPagination } from '../hooks/useMushafPagination';
import { useMushafBookmarks } from '../hooks/useMushafBookmarks';

export default function MushafScreen(){
  const { currentPage, nextPage, prevPage, goToPage } = useMushafPagination(1);
  const { bookmarks, toggleBookmark } = useMushafBookmarks();

  return (
    <View style={styles.container}>
      <MushafCard pageNumber={currentPage} onPageChange={goToPage} bookmarks={bookmarks} onBookmarkToggle={toggleBookmark} />
    </View>
  );
}

const styles = StyleSheet.create({ container:{ flex:1, backgroundColor:'#000' } });
