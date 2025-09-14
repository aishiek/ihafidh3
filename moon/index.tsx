import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const Moon = () => {
  return (
    <View style={styles.container}>
      <Text>Moon Component</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Moon;
