import QiblaFinder from '@/components/QiblaFinder';
import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { SafeAreaView, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function QiblaScreen() {
  const router = useRouter();
  const { theme } = useUnifiedTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}> 
      <View style={[styles.container, { backgroundColor: theme.background }]}> 
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.customHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}> 
          <View style={styles.customHeaderRow}> 
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}> 
              <ArrowLeft size={28} color="#FFD700" /> 
            </TouchableOpacity> 
          </View> 
        </View>
        <View style={styles.content}> 
          <QiblaFinder /> 
        </View> 
      </View> 
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  customHeader: { borderBottomWidth: 1, paddingTop: 72, paddingBottom: 12, paddingHorizontal: 20 },
  customHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  customHeaderTitleContainer: { flex: 1 },
  customHeaderTitle: { fontSize: 24, fontWeight: 'bold' },
  content: { flex: 1 }
});
