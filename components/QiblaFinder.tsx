// QiblaFinder.tsx - Enhanced with Traditional Compass Design
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, StyleSheet, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, G, Line, Polygon, RadialGradient, Stop, LinearGradient as SvgLinearGradient, Text as SvgText } from 'react-native-svg';

const { width } = Dimensions.get('window');
const COMPASS_SIZE = width * 0.82;
const CENTER = COMPASS_SIZE / 2;

// Removed CenterKaabaIcon (no longer needed) and kept only KaabaIcon for arrow tip
const KaabaIcon = ({ size = 24 }) => (
  <Svg width={size} height={size * 0.8} viewBox="0 0 32 24">
    <Defs>
      <SvgLinearGradient id="kaabaBodyArrow" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#1a1a1a" />
        <Stop offset="100%" stopColor="#000" />
      </SvgLinearGradient>
      <SvgLinearGradient id="kaabaBandArrow" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0%" stopColor="#fbbf24" />
        <Stop offset="100%" stopColor="#d97706" />
      </SvgLinearGradient>
    </Defs>
    <Polygon points="4,20 4,6 16,2 28,6 28,20 16,22" fill="url(#kaabaBodyArrow)" stroke="#333" strokeWidth="0.3" />
    <Line x1="4" y1="11" x2="28" y2="13" stroke="url(#kaabaBandArrow)" strokeWidth="2" />
  </Svg>
);

export default function QiblaFinder() {
  const insets = useSafeAreaInsets();
  const [deviceLocation, setDeviceLocation] = useState<Location.LocationObject | null>(null);
  const [heading, setHeading] = useState(0);
  const [qiblaAngle, setQiblaAngle] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAligned, setIsAligned] = useState(false);

  const compassRotation = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const alignmentGlow = useRef(new Animated.Value(0)).current;
  const lastHeadingUpdate = useRef(Date.now());
  const lastVibration = useRef(0);
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

  // Check alignment and provide feedback
  const checkAlignment = (currentHeading: number, targetAngle: number) => {
    let diff = Math.abs(currentHeading - targetAngle);
    if (diff > 180) diff = 360 - diff;
    
    const aligned = diff <= 10; // Within 10 degrees
    setIsAligned(aligned);
    
    if (aligned) {
      const now = Date.now();
      if (now - lastVibration.current > 2000) { // Vibrate every 2 seconds when aligned
        Vibration.vibrate([100, 50, 100]);
        lastVibration.current = now;
      }
      
      // Start alignment glow animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(alignmentGlow, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(alignmentGlow, { toValue: 0, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    }
  };

  useEffect(() => {
    Animated.timing(compassRotation, {
      toValue: -heading,
      duration: 200,
      useNativeDriver: true,
    }).start();
    
    checkAlignment(heading, qiblaAngle);
  }, [heading, qiblaAngle]);

  // Regular glow animation loop
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
        <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
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
              {/* Enhanced Compass */}
              <View style={styles.compassWrapper}>
                <View style={styles.compassContainer}>
                  {/* Fixed North Indicator */}
                  <View style={styles.northIndicator}>
                    <View style={styles.northTriangle} />
                    <Text style={styles.northText}>N</Text>
                  </View>
                  
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
                        {/* Enhanced compass face gradient */}
                        <RadialGradient id="compassFace" cx="50%" cy="50%" r="50%">
                          <Stop offset="0%" stopColor="#f8fafc" />
                          <Stop offset="70%" stopColor="#e2e8f0" />
                          <Stop offset="100%" stopColor="#cbd5e1" />
                        </RadialGradient>
                        <SvgLinearGradient id="qiblaArrow" x1="0%" y1="0%" x2="0%" y2="100%">
                          <Stop offset="0%" stopColor="#22c55e" />
                          <Stop offset="50%" stopColor="#16a34a" />
                          <Stop offset="100%" stopColor="#15803d" />
                        </SvgLinearGradient>
                        {/* Removed northArrow gradient */}
                      </Defs>

                      {/* Outer ring */}
                      <Circle cx={CENTER} cy={CENTER} r={CENTER - 3} fill="none" stroke="#b45309" strokeWidth="6" />
                      
                      {/* Compass face */}
                      <Circle cx={CENTER} cy={CENTER} r={CENTER - 12} fill="url(#compassFace)" stroke="#92400e" strokeWidth="2" />

                      {/* Degree markings and directional labels */}
                      {Array.from({ length: 72 }).map((_, i) => {
                        const angle = (i * 5) * (Math.PI / 180);
                        const isMainDirection = i % 18 === 0; // Every 90 degrees
                        const isCardinalDirection = i % 9 === 0; // Every 45 degrees
                        const isMajorTick = i % 6 === 0; // Every 30 degrees
                        
                        const outerRadius = CENTER - 15;
                        const innerRadius = CENTER - (isMainDirection ? 40 : isCardinalDirection ? 35 : isMajorTick ? 30 : 25);
                        
                        const x1 = CENTER + outerRadius * Math.cos(angle - Math.PI / 2);
                        const y1 = CENTER + outerRadius * Math.sin(angle - Math.PI / 2);
                        const x2 = CENTER + innerRadius * Math.cos(angle - Math.PI / 2);
                        const y2 = CENTER + innerRadius * Math.sin(angle - Math.PI / 2);
                        
                        const strokeColor = isMainDirection ? "#92400e" : isCardinalDirection ? "#a16207" : "#78716c";
                        const strokeWidth = isMainDirection ? 3 : isCardinalDirection ? 2 : 1;
                        
                        return (
                          <Line 
                            key={i} 
                            x1={x1} 
                            y1={y1} 
                            x2={x2} 
                            y2={y2} 
                            stroke={strokeColor} 
                            strokeWidth={strokeWidth} 
                          />
                        );
                      })}

                      {/* Direction labels */}
                      {['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map((direction, i) => {
                        const angle = (i * 45) * (Math.PI / 180);
                        const radius = CENTER - 50;
                        const x = CENTER + radius * Math.cos(angle - Math.PI / 2);
                        const y = CENTER + radius * Math.sin(angle - Math.PI / 2);
                        
                        return (
                          <SvgText
                            key={direction}
                            x={x}
                            y={y}
                            fontSize="16"
                            fontWeight="bold"
                            fill="#374151"
                            textAnchor="middle"
                            alignmentBaseline="middle"
                          >
                            {direction}
                          </SvgText>
                        );
                      })}

                      {/* Degree numbers */}
                      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((degree) => {
                        const angle = (degree) * (Math.PI / 180);
                        const radius = CENTER - 65;
                        const x = CENTER + radius * Math.cos(angle - Math.PI / 2);
                        const y = CENTER + radius * Math.sin(angle - Math.PI / 2);
                        
                        return (
                          <SvgText
                            key={degree}
                            x={x}
                            y={y}
                            fontSize="12"
                            fill="#6b7280"
                            textAnchor="middle"
                            alignmentBaseline="middle"
                          >
                            {degree}
                          </SvgText>
                        );
                      })}

                      {/* Qibla Arrow (green) with Kaaba icon at tip */}
                      <G origin={`${CENTER}, ${CENTER}`} rotation={qiblaAngle}>
                        <Line 
                          x1={CENTER} 
                          y1={CENTER} 
                          x2={CENTER} 
                          y2={CENTER - (CENTER - 70)} 
                          stroke="url(#qiblaArrow)" 
                          strokeWidth={8} 
                          strokeLinecap="round" 
                        />
                        <Polygon 
                          points={`${CENTER},${CENTER - (CENTER - 60)} ${CENTER - 12},${CENTER - (CENTER - 85)} ${CENTER + 12},${CENTER - (CENTER - 85)}`} 
                          fill="url(#qiblaArrow)" 
                        />
                        {/* Kaaba icon anchored at arrow tip. We translate so its bottom aligns roughly with the polygon tip */}
                        <G transform={`translate(${CENTER - 12}, ${CENTER - (CENTER - 100)})`}>
                          <KaabaIcon size={24} />
                        </G>
                      </G>

                      {/* Center circle (kept) */}
                      <Circle cx={CENTER} cy={CENTER} r={28} fill="#1f2937" stroke="#fbbf24" strokeWidth={3} />
                      <Circle cx={CENTER} cy={CENTER} r={22} fill="#facc15" stroke="#92400e" strokeWidth={2} />
                    </Svg>
                  </Animated.View>

                  {/* Pulsing Glow Effects */}
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
                  
                  {/* Alignment Glow */}
                  {isAligned && (
                    <Animated.View
                      style={[
                        styles.alignmentGlow,
                        {
                          transform: [
                            { scale: alignmentGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }
                          ],
                          opacity: alignmentGlow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] })
                        }
                      ]}
                    />
                  )}
                </View>
              </View>

              {/* Status indicator */}
              {isAligned && (
                <View style={styles.alignedIndicator}>
                  <Text style={styles.alignedText}>✅ Aligned with Qibla!</Text>
                </View>
              )}

              {/* Info */}
              <View style={styles.infoPanel}>
                <Text style={styles.infoText}>Qibla: {qiblaAngle.toFixed(0)}°</Text>
                <Text style={styles.infoText}>Heading: {heading.toFixed(0)}°</Text>
                <Text style={styles.infoText}>Difference: {Math.abs(((heading - qiblaAngle + 540) % 360) - 180).toFixed(0)}°</Text>
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
  compassContainer: { 
    position: 'relative',
    width: COMPASS_SIZE,
    height: COMPASS_SIZE,
  },
  northIndicator: {
    position: 'absolute',
    top: -25,
    left: '50%',
    marginLeft: -15,
    alignItems: 'center',
    zIndex: 10,
  },
  northTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 12,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#ef4444',
  },
  northText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ef4444',
    marginTop: 2,
  },
  glow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#facc15',
    top: CENTER - 40,
    left: CENTER - 40,
  },
  alignmentGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#22c55e',
    top: CENTER - 50,
    left: CENTER - 50,
  },
  alignedIndicator: {
    marginTop: 20,
    padding: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  alignedText: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  infoPanel: { 
    marginTop: 30, 
    padding: 16, 
    borderRadius: 16, 
    backgroundColor: 'rgba(255,255,255,0.1)' 
  },
  infoText: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#f8fafc', 
    textAlign: 'center' 
  },
  mockNote: { 
    marginTop: 10, 
    fontSize: 12, 
    color: '#94a3b8', 
    fontStyle: 'italic' 
  }
});