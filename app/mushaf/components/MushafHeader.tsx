import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ArrowLeft, Bookmark } from 'lucide-react-native';

export default function MushafHeader({ pageNumber, totalPages, isBookmarked, onBookmarkToggle, onClose }:{pageNumber:number; totalPages:number; isBookmarked:boolean; onBookmarkToggle:()=>void; onClose:()=>void;}){
  return (
    <View style={styles.header}>
      <Pressable onPress={onClose}><ArrowLeft color="#fff" /></Pressable>
      <Text style={styles.title}>{pageNumber}/{totalPages}</Text>
      <Pressable onPress={onBookmarkToggle}><Bookmark color={isBookmarked? '#FFD700' : '#fff'} /></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({ header:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:12, backgroundColor:'#0b0b0b' }, title:{ color:'#fff', fontWeight:'700' } });
