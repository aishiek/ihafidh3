import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { getLunarPhaseCached, LunarPhaseData } from '@/services/moon/lunarPhase';
import MoonPhaseCard from '@/components/moon/MoonPhaseCard';
import { ArrowLeft } from 'lucide-react-native';
import { useRouter, Stack } from 'expo-router';
import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';

export default function MoonPhasesScreen() {
  const [data, setData] = useState<LunarPhaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { theme } = useUnifiedTheme();

  useEffect(() => {
    (async () => {
      try { const d = await getLunarPhaseCached(); setData(d); } finally { setLoading(false); }
    })();
  }, []);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Custom Header with Back Arrow */}
      <View style={[styles.customHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.customHeaderRow}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <ArrowLeft size={28} color="#FFD700" />
          </TouchableOpacity>
          <View style={styles.customHeaderTitleContainer}>
            <Text style={[styles.customHeaderTitle, { color: theme.text }]}>
              Moon Phases
            </Text>
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent || '#facc15'} />
          </View>
        )}
        {!loading && data && <MoonPhaseCard data={data} />}
        {!loading && !data && <Text style={{ color: theme.text, textAlign: 'center', marginTop: 20 }}>Failed to load data.</Text>}
      </ScrollView>
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
    paddingTop: 50, // Add top padding to avoid status bar overlap
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  customHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customHeaderTitleContainer: {
    flex: 1,
  },
  customHeaderTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
});
