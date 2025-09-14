import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const Qibla = () => {
  return (
    <View style={styles.container}>
      <Text>Qibla Component</Text>
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

export default Qibla;
