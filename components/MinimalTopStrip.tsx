import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MinimalTopStrip = ({ width = '100%', height = 40, style }) => (
  <View style={[{ width, height, marginVertical: 8, justifyContent: 'center', alignItems: 'center' }, style]}>
    <View style={styles.stripBorder} />
    {/* Corner squares */}
    <View style={[styles.cornerSquare, { left: 0 }]} />
    <View style={[styles.cornerSquare, { right: 0 }]} />
    {/* Center Arabic calligraphy */}
    <Text style={styles.stripText}>﷽</Text>
  </View>
);

const styles = StyleSheet.create({
  stripBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 3,
    borderColor: '#FFD700',
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  cornerSquare: {
    position: 'absolute',
    top: -4,
    width: 10,
    height: 10,
    backgroundColor: '#B8860B',
    borderRadius: 2,
  },
  stripText: {
    fontSize: 20,
    color: '#FFD700',
    textAlign: 'center',
    zIndex: 1,
  },
});

export default MinimalTopStrip;
