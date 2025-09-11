// QiblaFinder.tsx - With Pulsing Glow Around Kaaba
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, Dimensions, StyleSheet, Animated } from 'react-native';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Polygon, G, Defs, RadialGradient, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');
const COMPASS_SIZE = width * 0.82;
const CENTER = COMPASS_SIZE / 2;

// Kaaba Icon
const KaabaIcon = ({ size = 40 }) => (
  <Svg width={size} height={size * 0.75} viewBox="0 0 64 48">
    <Defs>
      <SvgLinearGradient id="kaabaBody" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#111" />
        <Stop offset="100%" stopColor="#000" />
      </SvgLinearGradient>
      <SvgLinearGradient id="kaabaBand" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0%" stopColor="#fbbf24" />
        <Stop offset="100%" stopColor="#d97706" />
      </SvgLinearGradient>
    </Defs>
    <Polygon points="8,40 8,12 32,4 56,12 56,40 32,44" fill="url(#kaabaBody)" stroke="#444" strokeWidth="0.5" />
    <Line x1="8" y1="22" x2="56" y2="26" stroke="url(#kaabaBand)" strokeWidth="4" />
  </Svg>
);

export default function QiblaFinder() {
  const insets = useSafeAreaInsets();
  const [deviceLocation, setDeviceLocation] = useState<Location.LocationObject | null>(null);
  const [heading, setHeading] = useState(0);
  const [qiblaAngle, setQiblaAngle] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const compassRotation = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current; // 👈 pulsing glow
  const lastHeadingUpdate = useRef(Date.now());
  const isExpoGo = Constants.appOwnership === 'expo';

  const computeQibla = (lat: number, lng: number) => {
    const kaaba = { lat: 21.4225, lng: 39.8262 };
    const φ1 = (lat * Math.PI) / 180;
    const φ2 = (kaaba.lat * Math.PI) / 180;
    const Δλ = ((kaaba.lng - lng) * Math.PI) / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
  };

  useEffect(() => {
    Animated.timing(compassRotation, {
      toValue: -heading,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [heading]);

  // 🔆 Glow Animation Loop
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    let magSub: any;
    let headingSub: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Location permission denied.');
          setIsLoading(false);
          return;
        }

        let currentLocation: Location.LocationObject;
        if (isExpoGo) {
          currentLocation = {
            coords: {
              latitude: 1.3521, longitude: 103.8198,
              accuracy: 30, altitude: 0, heading: 0, speed: 0
            },
            timestamp: Date.now()
          } as Location.LocationObject;
        } else {
          currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }

        setDeviceLocation(currentLocation);
        setQiblaAngle(computeQibla(currentLocation.coords.latitude, currentLocation.coords.longitude));

        try {
          headingSub = await Location.watchHeadingAsync(h => {
            const val = h.trueHeading ?? h.magHeading ?? 0;
            const now = Date.now();
            if (now - lastHeadingUpdate.current > 100) {
              lastHeadingUpdate.current = now;
              setHeading(val);
            }
          });
        } catch {
          magSub = Magnetometer.addListener(data => {
            const angle = (Math.atan2(data.y, data.x) * 180) / Math.PI;
            const normalized = (angle + 360) % 360;
            const now = Date.now();
            if (now - lastHeadingUpdate.current > 100) {
              lastHeadingUpdate.current = now;
              setHeading(normalized);
            }
          });
        }
      } catch {
        setErrorMsg('Failed to acquire location.');
      } finally {
        setIsLoading(false);
      }
    })();
    return () => {
      if (magSub) magSub.remove();
      if (headingSub) headingSub.remove();
    };
  }, [isExpoGo]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0f172a', '#1e3a8a', '#0f172a']} style={styles.gradient}>
        <View style={[styles.container, { paddingTop: insets.top + 20 }]}> {/* restored smaller padding; header removed externally */}
          <Text style={styles.title}>🕌 Qibla Finder</Text>
          <Text style={styles.subtitle}>Align yourself towards Mecca</Text>
          {isLoading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color="#facc15" />
              <Text style={styles.loaderText}>Acquiring sensors...</Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : (
            <>
              {/* Compass */}
              <View style={styles.compassWrapper}> {/* reverted to original marginTop from styles (30) */}
                <Animated.View
                  style={{
                    transform: [{
                      rotate: compassRotation.interpolate({
                        inputRange: [-360, 0, 360],
                        outputRange: ['-360deg', '0deg', '360deg']
                      })
                    }]
                  }}
                >
                  <Svg width={COMPASS_SIZE} height={COMPASS_SIZE}>
                    <Defs>
                      <RadialGradient id="faceGradient" cx="50%" cy="50%" r="50%">
                        <Stop offset="0%" stopColor="#1e293b" />
                        <Stop offset="100%" stopColor="#111827" />
                      </RadialGradient>
                      <SvgLinearGradient id="qArrow" x1="0%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor="#34d399" />
                        <Stop offset="100%" stopColor="#059669" />
                      </SvgLinearGradient>
                    </Defs>

                    {/* Dial */}
                    <Circle cx={CENTER} cy={CENTER} r={CENTER - 6} fill="url(#faceGradient)" stroke="#facc15" strokeWidth="6" />

                    {/* Ticks */}
                    {Array.from({ length: 36 }).map((_, i) => {
                      const angle = (i * 10) * (Math.PI / 180);
                      const x1 = CENTER + (CENTER - 15) * Math.cos(angle);
                      const y1 = CENTER + (CENTER - 15) * Math.sin(angle);
                      const x2 = CENTER + (CENTER - (i % 9 === 0 ? 35 : 25)) * Math.cos(angle);
                      const y2 = CENTER + (CENTER - (i % 9 === 0 ? 35 : 25)) * Math.sin(angle);
                      return (
                        <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 9 === 0 ? "#fbbf24" : "#475569"} strokeWidth={i % 9 === 0 ? 3 : 1} />
                      );
                    })}

                    {/* Qibla Arrow */}
                    <G origin={`${CENTER}, ${CENTER}`} rotation={qiblaAngle}>
                      <Line x1={CENTER} y1={CENTER} x2={CENTER} y2={CENTER - (CENTER - 60)} stroke="url(#qArrow)" strokeWidth={8} strokeLinecap="round" />
                      <Polygon points={`${CENTER},${CENTER - (CENTER - 60)} ${CENTER - 14},${CENTER - (CENTER - 40)} ${CENTER + 14},${CENTER - (CENTER - 40)}`} fill="url(#qArrow)" />
                    </G>

                    {/* Center Circle */}
                    <Circle cx={CENTER} cy={CENTER} r={22} fill="#facc15" stroke="#000" strokeWidth={2} />
                  </Svg>
                  {/* Pulsing Glow */}
                  <Animated.View
                    style={[
                      styles.glow,
                      {
                        transform: [
                          { scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }
                        ],
                        opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0] })
                      }
                    ]}
                  />
                  <View style={styles.kaabaOverlay}>
                    <KaabaIcon size={34} />
                  </View>
                </Animated.View>
              </View>
              {/* Info */}
              <View style={styles.infoPanel}>
                <Text style={styles.infoText}>Qibla: {qiblaAngle.toFixed(0)}°</Text>
                <Text style={styles.infoText}>Heading: {heading.toFixed(0)}°</Text>
              </View>
              {isExpoGo && (
                <Text style={styles.mockNote}>(Mock location in Expo Go)</Text>
              )}
            </>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gradient: { flex: 1 },
  container: { flex: 1, alignItems: 'center' },
  title: { fontSize: 30, fontWeight: 'bold', color: '#f8fafc' },
  subtitle: { fontSize: 14, color: '#cbd5e1', marginBottom: 20 },
  loaderWrap: { marginTop: 80, alignItems: 'center' },
  loaderText: { marginTop: 12, color: '#f1f5f9' },
  errorWrap: { marginTop: 80, padding: 16, backgroundColor: 'rgba(255,0,0,0.1)', borderRadius: 12 },
  errorText: { color: '#f87171', textAlign: 'center' },
  compassWrapper: { marginTop: 30, justifyContent: 'center', alignItems: 'center' },
  glow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#facc15',
    top: CENTER - 40,
    left: CENTER - 40,
  },
  kaabaOverlay: { position: 'absolute', top: '42%', left: '42%' },
  infoPanel: { marginTop: 30, padding: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)' },
  infoText: { fontSize: 18, fontWeight: '600', color: '#f8fafc', textAlign: 'center' },
  mockNote: { marginTop: 10, fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }
});
