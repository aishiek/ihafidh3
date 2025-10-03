import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import { getLunarPhaseCached, LunarPhaseData } from '@/services/moon/lunarPhase';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const MOON_SIZE = Math.min(width * 0.6, 280);

const MoonVisualization = ({ illumination, phase }: { illumination: number; phase: string }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Continuous rotation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 60000,
        useNativeDriver: true,
      })
    ).start();

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Subtle scale pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  // Calculate shadow position based on phase
  const shadowOffset = ((illumination / 100) - 0.5) * MOON_SIZE;

  return (
    <View style={moonStyles.moonContainer}>
      {/* Outer glow rings */}
      <Animated.View 
        style={[
          moonStyles.glowRing, 
          moonStyles.glowRing1,
          { 
            opacity: glowOpacity,
            transform: [{ scale: pulseAnim }]
          }
        ]} 
      />
      <Animated.View 
        style={[
          moonStyles.glowRing, 
          moonStyles.glowRing2,
          { 
            opacity: glowOpacity,
            transform: [{ scale: pulseAnim }]
          }
        ]} 
      />
      
      {/* Stars background */}
      <View style={moonStyles.starsContainer}>
        {[...Array(30)].map((_, i) => (
          <View
            key={i}
            style={[
              moonStyles.star,
              {
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                width: Math.random() * 3 + 1,
                height: Math.random() * 3 + 1,
                opacity: Math.random() * 0.8 + 0.2,
              }
            ]}
          />
        ))}
      </View>

      {/* Main moon */}
      <Animated.View 
        style={[
          moonStyles.moon,
          { 
            transform: [
              { rotate: rotation },
              { scale: pulseAnim }
            ]
          }
        ]}
      >
        {/* Moon surface with craters */}
        <View style={moonStyles.moonSurface}>
          <View style={[moonStyles.crater, moonStyles.crater1]} />
          <View style={[moonStyles.crater, moonStyles.crater2]} />
          <View style={[moonStyles.crater, moonStyles.crater3]} />
          <View style={[moonStyles.crater, moonStyles.crater4]} />
        </View>

        {/* Shadow overlay for phase */}
        <View 
          style={[
            moonStyles.shadow,
            {
              transform: [{ translateX: shadowOffset }],
            }
          ]}
        />
      </Animated.View>

      {/* Phase label */}
      <View style={moonStyles.phaseLabel}>
        <Text style={moonStyles.phaseName}>{phase}</Text>
        <Text style={moonStyles.illuminationText}>{illumination}% Illuminated</Text>
      </View>
    </View>
  );
};

const InfoCard = ({ icon, label, value, subtitle }: { icon: string; label: string; value: string; subtitle?: string }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View 
      style={[
        moonStyles.infoCard,
        { transform: [{ scale: scaleAnim }] }
      ]}
    >
      <View style={moonStyles.infoCardHeader}>
        <Text style={moonStyles.infoIcon}>{icon}</Text>
        <Text style={moonStyles.infoLabel}>{label}</Text>
      </View>
      <Text style={moonStyles.infoValue}>{value}</Text>
      {subtitle && <Text style={moonStyles.infoSubtitle}>{subtitle}</Text>}
    </Animated.View>
  );
};

export default function MoonPhasesScreen() {
  const [data, setData] = useState<LunarPhaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const router = useRouter();
  const { theme } = useUnifiedTheme();
  const insets = useSafeAreaInsets();
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true); 
    else setRefreshing(true);
    setError(null);
    
    try {
      const d = await getLunarPhaseCached();
      setData(d);
      setLastUpdated(new Date());
      
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    } catch (e: any) {
      setError('Failed to load lunar phase data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fadeAnim]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const d = await getLunarPhaseCached();
        if (!mounted) return;
        setData(d);
        setLastUpdated(new Date());
        
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();
      } catch {
        if (mounted) setError('Failed to load lunar phase data.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [fadeAnim]);

  const onRefresh = () => fetchData(true);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const headerPaddingTop = insets.top + 8;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Custom Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border, paddingTop: headerPaddingTop }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={28} color="#FFD700" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Moon Phases
            </Text>
            {lastUpdated && !loading && (
              <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
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
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent || '#facc15'} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading celestial data...
            </Text>
          </View>
        )}
        
        {!loading && error && (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
            <TouchableOpacity
              onPress={() => fetchData(false)}
              style={[styles.retryButton, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.retryButtonText, { color: theme.background }]}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        )}
        
        {!loading && !error && data && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <MoonVisualization 
              illumination={Math.round((data.illumination ?? 0) * 100)} 
              phase={data.phaseName}
            />

            <View style={moonStyles.infoGrid}>
              <InfoCard
                icon="📅"
                label="Lunar Age"
                value={`${(data.ageDays ?? 0).toFixed(1)} days`}
                subtitle="Since new moon"
              />
              <InfoCard
                icon="�"
                label="Cycle Progress"
                value={`${Math.round((data.cycleProgress ?? 0) * 100)}%`}
                subtitle="Through synodic month"
              />
            </View>

            <View style={moonStyles.upcomingSection}>
              <Text style={moonStyles.sectionTitle}>Upcoming Events</Text>
              
              <View style={moonStyles.eventCard}>
                <View style={moonStyles.eventIcon}>
                  <Text style={moonStyles.eventEmoji}>🌑</Text>
                </View>
                <View style={moonStyles.eventInfo}>
                  <Text style={moonStyles.eventLabel}>Next New Moon</Text>
                  <Text style={moonStyles.eventDate}>{formatDate(new Date(data.nextNewMoon))}</Text>
                </View>
              </View>

              <View style={moonStyles.eventCard}>
                <View style={moonStyles.eventIcon}>
                  <Text style={moonStyles.eventEmoji}>🌕</Text>
                </View>
                <View style={moonStyles.eventInfo}>
                  <Text style={moonStyles.eventLabel}>Next Full Moon</Text>
                  <Text style={moonStyles.eventDate}>{formatDate(new Date(data.nextFullMoon))}</Text>
                </View>
              </View>
            </View>

            <View style={moonStyles.phaseGuide}>
              <Text style={moonStyles.sectionTitle}>Lunar Phases</Text>
              <View style={moonStyles.phaseRow}>
                {['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'].map((emoji, i) => (
                  <View key={i} style={moonStyles.phaseItem}>
                    <Text style={moonStyles.phaseEmoji}>{emoji}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        )}
        
        {!loading && !error && !data && (
          <Text style={{ color: theme.text, textAlign: 'center', marginTop: 20 }}>
            No data available.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  errorText: {
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 15,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  retryButtonText: {
    fontWeight: '600',
    fontSize: 15,
  },
});

const moonStyles = StyleSheet.create({
  moonContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    position: 'relative',
  },
  starsContainer: {
    position: 'absolute',
    width: MOON_SIZE * 1.8,
    height: MOON_SIZE * 1.8,
  },
  star: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 50,
  },
  glowRing: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'transparent',
  },
  glowRing1: {
    width: MOON_SIZE * 1.3,
    height: MOON_SIZE * 1.3,
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  glowRing2: {
    width: MOON_SIZE * 1.5,
    height: MOON_SIZE * 1.5,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.15)',
  },
  moon: {
    width: MOON_SIZE,
    height: MOON_SIZE,
    borderRadius: MOON_SIZE / 2,
    backgroundColor: '#f5f5dc',
    overflow: 'hidden',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  moonSurface: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  crater: {
    position: 'absolute',
    backgroundColor: 'rgba(169, 169, 169, 0.3)',
    borderRadius: 999,
  },
  crater1: {
    width: 30,
    height: 30,
    top: '20%',
    left: '25%',
  },
  crater2: {
    width: 20,
    height: 20,
    top: '45%',
    left: '60%',
  },
  crater3: {
    width: 25,
    height: 25,
    top: '65%',
    left: '35%',
  },
  crater4: {
    width: 15,
    height: 15,
    top: '30%',
    left: '70%',
  },
  shadow: {
    position: 'absolute',
    width: MOON_SIZE,
    height: MOON_SIZE,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: MOON_SIZE / 2,
  },
  phaseLabel: {
    marginTop: 24,
    alignItems: 'center',
  },
  phaseName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFD700',
    marginBottom: 4,
  },
  illuminationText: {
    fontSize: 14,
    color: '#888888',
  },
  infoGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 20,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  infoSubtitle: {
    fontSize: 11,
    color: '#666666',
  },
  upcomingSection: {
    paddingHorizontal: 20,
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  eventIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  eventEmoji: {
    fontSize: 24,
  },
  eventInfo: {
    flex: 1,
  },
  eventLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 13,
    color: '#888888',
  },
  phaseGuide: {
    paddingHorizontal: 20,
    marginTop: 32,
  },
  phaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  phaseItem: {
    alignItems: 'center',
  },
  phaseEmoji: {
    fontSize: 24,
  },
});