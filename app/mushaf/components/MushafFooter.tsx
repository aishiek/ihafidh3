import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

export default function MushafFooter({ pageNumber, totalPages, onPrevious, onNext }:{pageNumber:number; totalPages:number; onPrevious:()=>void; onNext:()=>void;}){
  return (
    <View style={styles.footer}>
      <Pressable onPress={onPrevious}><ChevronLeft color="#fff" /></Pressable>
      <Text style={styles.pageText}>{pageNumber} / {totalPages}</Text>
      <Pressable onPress={onNext}><ChevronRight color="#fff" /></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({ footer:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:12, backgroundColor:'#0b0b0b' }, pageText:{ color:'#fff', fontWeight:'700' } });
