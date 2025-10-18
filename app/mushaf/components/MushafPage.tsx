import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';
import type { MushafPageLayout } from '../types/mushaf.types';

export default function MushafPage({ layout }:{layout: MushafPageLayout | null}){
  if (!layout) return <View style={styles.empty} />;
  return (
    <View style={styles.container}>
      <Image source={{ uri: layout.imageUri }} style={styles.image} resizeMode="contain" />
      <Svg style={styles.overlay} viewBox="0 0 600 900">
        {layout.words.map((w, i) => (
          <SvgText key={`${w.key}-${i}`} x={w.x} y={w.y} fill={w.tajweedColor || '#fff'} fontSize={Math.max(8, w.h * 0.75)} fontFamily="Arabic">
            {w.text || ''}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ container:{ flex:1, alignItems:'center', justifyContent:'center' }, image:{ width:'100%', height:'100%' }, overlay:{ position:'absolute', top:0, left:0, right:0, bottom:0 }, empty:{ flex:1 } });
