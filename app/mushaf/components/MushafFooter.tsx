import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MushafFooter({ pageNumber, totalPages, onPrevious, onNext, onPrevSurah, onGoToSurah, onNextSurah, isDbReady }:{pageNumber:number; totalPages:number; onPrevious:()=>void; onNext:()=>void; onPrevSurah?:()=>void; onGoToSurah?:()=>void; onNextSurah?:()=>void; isDbReady?: boolean;}){
  const animPrev = React.useRef(new Animated.Value(1)).current;
  const animNext = React.useRef(new Animated.Value(1)).current;

  const pressAnim = (anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 0.92, duration: 90, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  return (
    <SafeAreaView edges={[ 'bottom' ]} style={styles.safeArea}>
      <View style={styles.footer}>
        <View style={styles.leftGroup}>
          <Animated.View style={{ transform:[{ scale: animPrev }] }}>
            <Pressable onPress={() => { pressAnim(animPrev); onPrevious(); }} style={styles.iconBtn} accessibilityLabel="Prev">
              <Text style={styles.pageText}>Prev</Text>
            </Pressable>
          </Animated.View>
        </View>

        <View style={styles.centerGroup}>
          <Pressable onPress={onGoToSurah} disabled={!isDbReady} style={[styles.surahBtn, !isDbReady && styles.disabled]} accessibilityLabel="Surah Picker">
            <Text style={styles.surahText}>Surah</Text>
          </Pressable>
        </View>

        <View style={styles.rightGroup}>
          <Animated.View style={{ transform:[{ scale: animNext }] }}>
            <Pressable onPress={() => { pressAnim(animNext); onNext(); }} style={styles.iconBtn} accessibilityLabel="Next">
              <Text style={styles.pageText}>Next</Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#0b0b0b' },
  footer:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:12, paddingVertical:8, backgroundColor:'#0b0b0b' },
  leftGroup: { flexDirection: 'row', alignItems: 'center' },
  rightGroup: { flexDirection: 'row', alignItems: 'center' },
  centerGroup: { alignItems: 'center' },
  pageText:{ color:'#fff', fontWeight:'700', marginBottom: 4 },
  iconBtn: { width:44, height:44, borderRadius:8, alignItems:'center', justifyContent:'center' },
  surahBtn: { paddingHorizontal:12, paddingVertical:8, backgroundColor:'#FFD166', borderRadius:8, marginTop:4 },
  surahLabel: { color: '#cbd5e1', fontSize: 12, marginBottom: 4 },
  surahText: { color:'#1a1a2e', fontWeight:'700' },
  goBtn: { marginTop:4, backgroundColor:'#0ea5a4', paddingHorizontal:10, paddingVertical:6, borderRadius:8 },
  goText: { color:'#042f2e', fontWeight:'700' }
  ,disabled: { opacity: 0.5 }
});
