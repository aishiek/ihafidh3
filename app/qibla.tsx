import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import QiblaFinder from '@/components/QiblaFinder';

export default function QiblaScreen() {
  const router = useRouter();
  const { theme } = useUnifiedTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen
          options={{
            headerShown: false, // Hide the default header
          }}
        />

        {/* Custom Header with Back Arrow */}
        <View style={[styles.customHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={styles.customHeaderRow}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
              <ArrowLeft size={28} color="#FFD700" />
            </TouchableOpacity>
            {/* Removed header title per request */}
          </View>
        </View>

        {/* Qibla Finder Component */}
        <View style={styles.content}>
          <QiblaFinder />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  customHeader: {
    borderBottomWidth: 1,
    paddingTop: 72, // increased further down (3x) per request
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  customHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customHeaderTitleContainer: {
    flex: 1,
  },
  customHeaderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
});
