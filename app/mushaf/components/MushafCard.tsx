import React, { useEffect, useState } from 'react';
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import MushafHeader from './MushafHeader';
import MushafFooter from './MushafFooter';
import MushafPage from './MushafPage';
import { getPageLayout } from '../services/mushafLayoutService';

export default function MushafCard({ pageNumber, onPageChange, bookmarks, onBookmarkToggle }:{ pageNumber:number; onPageChange:(n:number)=>void; bookmarks:Set<number>; onBookmarkToggle:(n:number)=>void; }){
  const [layout, setLayout] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPageLayout(pageNumber).then(l => { if (!cancelled) setLayout(l); }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pageNumber]);

  const handlePrev = () => onPageChange(Math.max(1, pageNumber - 1));
  const handleNext = () => onPageChange(Math.min(610, pageNumber + 1));

  return (
    <Pressable style={styles.container}>
      <MushafHeader pageNumber={pageNumber} totalPages={610} isBookmarked={bookmarks.has(pageNumber)} onBookmarkToggle={() => onBookmarkToggle(pageNumber)} onClose={() => { /* to be handled by parent */ }} />
      {loading ? <ActivityIndicator size="large" /> : <MushafPage layout={layout} />}
      <MushafFooter pageNumber={pageNumber} totalPages={610} onPrevious={handlePrev} onNext={handleNext} />
    </Pressable>
  );
}

const styles = StyleSheet.create({ container:{ flex:1 } });
