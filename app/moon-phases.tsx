import MoonPhaseCard from '@/components/moon/MoonPhaseCard';
import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import { getLunarPhaseCached, LunarPhaseData } from '@/services/moon/lunarPhase';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MoonPhasesScreen() {
  const [data, setData] = useState<LunarPhaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const router = useRouter();
  const { theme } = useUnifiedTheme();
  const insets = useSafeAreaInsets();

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const d = await getLunarPhaseCached();
      setData(d);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError('Failed to load lunar phase data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const d = await getLunarPhaseCached();
        if (!mounted) return;
        setData(d);
        setLastUpdated(new Date());
      } catch {
        if (mounted) setError('Failed to load lunar phase data.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const onRefresh = () => fetchData(true);

  const headerPaddingTop = insets.top + 8;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Custom Header */}
      <View style={[styles.customHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border, paddingTop: headerPaddingTop }]}>
        <View style={styles.customHeaderRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={28} color="#FFD700" />
          </TouchableOpacity>
          <View style={styles.customHeaderTitleContainer}>
            <Text style={[styles.customHeaderTitle, { color: theme.text }]}>
              Moon Phases
            </Text>
            {lastUpdated && !loading && (
              <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>
                Updated {lastUpdated.toLocaleTimeString()}
              </Text>
            )}
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent || '#facc15'} />
          </View>
        )}
        {!loading && error && (
          <View style={{ alignItems: 'center', marginTop: 30 }}>
            <Text style={{ color: theme.error, marginBottom: 12 }}>{error}</Text>
            <TouchableOpacity
              onPress={() => fetchData(false)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 20,
                backgroundColor: theme.primary,
                borderRadius: 8
              }}
            >
              <Text style={{ color: theme.background, fontWeight: '600' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        {!loading && !error && data && <MoonPhaseCard data={data} />}
        {!loading && !error && !data && (
          <Text style={{ color: theme.text, textAlign: 'center', marginTop: 20 }}>No data available.</Text>
        )}
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
