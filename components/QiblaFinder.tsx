// QiblaFinder.tsx - Fixed with Magnetic Declination Correction
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Platform, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, G, Line, Polygon, RadialGradient, Stop, LinearGradient as SvgLinearGradient, Text as SvgText } from 'react-native-svg';

const { width } = Dimensions.get('window');
const COMPASS_SIZE = width * 0.82;
const CENTER = COMPASS_SIZE / 2;

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
  const [magneticHeading, setMagneticHeading] = useState(0);
  const [qiblaAngleTrueNorth, setQiblaAngleTrueNorth] = useState(0);
  const [magneticDeclination, setMagneticDeclination] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAligned, setIsAligned] = useState(false);
  const [needsCalibration, setNeedsCalibration] = useState(false);
  const [compassAccuracy, setCompassAccuracy] = useState<number | null>(null);

  const compassRotation = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const alignmentGlow = useRef(new Animated.Value(0)).current;
  const lastHeadingUpdate = useRef(Date.now());
  const lastVibration = useRef(0);
  const isExpoGo = Constants.appOwnership === 'expo';

  // Calculate Qibla direction from any location to Kaaba (returns true north bearing)
  const computeQibla = (lat: number, lng: number) => {
    const kaaba = { lat: 21.4225, lng: 39.8262 };
    const φ1 = (lat * Math.PI) / 180;
    const φ2 = (kaaba.lat * Math.PI) / 180;
    const Δλ = ((kaaba.lng - lng) * Math.PI) / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
  };

  // Calculate magnetic declination (simplified approximation)
  // For production, use a proper library like geomagnetism or geomag
  const calculateMagneticDeclination = (lat: number, lng: number): number => {
    // This is a simplified approximation. For accurate results, you should:
    // 1. Use the World Magnetic Model (WMM)
    // 2. Or fetch from an API like NOAA
    // 3. Or use a library like 'geomagnetism'
    
    // Rough approximation formula (not highly accurate but better than nothing)
    // For better accuracy, consider integrating: https://www.ngdc.noaa.gov/geomag/calculators/magcalc.shtml
    
    // This is a very simplified model and should be replaced with proper WMM
    const year = new Date().getFullYear();
    const baseYear = 2020;
    const yearsSince = year - baseYear;
    
    // Very rough approximation based on longitude/latitude
    // Eastern longitudes typically have positive declination in Asia
    // Western longitudes typically have negative in Americas
    let declination = 0;
    
    // For Singapore area (as in your mock location)
    if (lat > -10 && lat < 10 && lng > 90 && lng < 120) {
      declination = 0.5; // Singapore has very small declination
    }
    // For Middle East
    else if (lat > 15 && lat < 35 && lng > 35 && lng < 60) {
      declination = 2 + (yearsSince * 0.05);
    }
    // For Europe
    else if (lat > 35 && lat < 70 && lng > -10 && lng < 40) {
      declination = 3 + (yearsSince * 0.1);
    }
    // For North America (East Coast)
    else if (lat > 25 && lat < 50 && lng > -90 && lng < -60) {
      declination = -12 + (yearsSince * 0.1);
    }
    // For North America (West Coast)
    else if (lat > 30 && lat < 50 && lng > -130 && lng < -100) {
      declination = 15 + (yearsSince * 0.1);
    }
    // Default rough calculation
    else {
      declination = lng / 20; // Very rough approximation
    }
    
    return declination;
  };

  // Convert true north bearing to magnetic bearing
  const trueToMagnetic = (trueNorthAngle: number, declination: number): number => {
    return (trueNorthAngle - declination + 360) % 360;
  };

  // Check alignment and provide feedback
  const checkAlignment = (currentMagneticHeading: number, qiblaMagnetic: number) => {
    let diff = Math.abs(currentMagneticHeading - qiblaMagnetic);
    if (diff > 180) diff = 360 - diff;
    
    const aligned = diff <= 5; // Within 5 degrees for stricter accuracy
    setIsAligned(aligned);
    
    if (aligned) {
      const now = Date.now();
      if (now - lastVibration.current > 2000) {
        Vibration.vibrate([100, 50, 100]);
        lastVibration.current = now;
      }
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(alignmentGlow, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(alignmentGlow, { toValue: 0, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    }
  };

  // Calculate Qibla direction in magnetic coordinates
  const qiblaMagnetic = trueToMagnetic(qiblaAngleTrueNorth, magneticDeclination);

  useEffect(() => {
    Animated.timing(compassRotation, {
      toValue: -magneticHeading,
      duration: 200,
      useNativeDriver: true,
    }).start();
    
    checkAlignment(magneticHeading, qiblaMagnetic);
  }, [magneticHeading, qiblaMagnetic]);

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
        if (!Location?.requestForegroundPermissionsAsync) {
          setErrorMsg('Location module unavailable');
          setIsLoading(false);
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync().catch(() => ({ status: 'denied' } as any));
        if (status !== 'granted') {
          setErrorMsg('Location permission denied. Please enable location access.');
          setIsLoading(false);
          return;
        }

        // Get current location
        let currentLocation: Location.LocationObject;
        if (isExpoGo) {
          // Singapore mock location
          currentLocation = {
            coords: {
              latitude: 1.3521, longitude: 103.8198,
              accuracy: 30, altitude: 0, heading: 0, speed: 0
            },
            timestamp: Date.now()
          } as Location.LocationObject;
        } else if (Location?.getCurrentPositionAsync) {
          try {
            currentLocation = await Location.getCurrentPositionAsync({ 
              accuracy: Location.Accuracy?.High || 4 
            });
          } catch (e) {
            console.warn('[location] getCurrentPosition failed', e);
            setErrorMsg('Could not get accurate location. Please check GPS settings.');
            setIsLoading(false);
            return;
          }
        } else {
          setErrorMsg('Location services unavailable');
          setIsLoading(false);
          return;
        }

        setDeviceLocation(currentLocation);
        
        // Calculate Qibla direction (true north)
        const qiblaTrueNorth = computeQibla(
          currentLocation.coords.latitude, 
          currentLocation.coords.longitude
        );
        setQiblaAngleTrueNorth(qiblaTrueNorth);

        // Calculate magnetic declination for this location
        const declination = calculateMagneticDeclination(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude
        );
        setMagneticDeclination(declination);

        console.log('[Qibla] Location:', currentLocation.coords.latitude, currentLocation.coords.longitude);
        console.log('[Qibla] True North Qibla:', qiblaTrueNorth.toFixed(2));
        console.log('[Qibla] Magnetic Declination:', declination.toFixed(2));
        console.log('[Qibla] Magnetic North Qibla:', trueToMagnetic(qiblaTrueNorth, declination).toFixed(2));

        // Try to use Location.watchHeadingAsync first (gives better results)
        if (Location?.watchHeadingAsync) {
          try {
            headingSub = await Location.watchHeadingAsync(h => {
              const now = Date.now();
              if (now - lastHeadingUpdate.current > 100) {
                lastHeadingUpdate.current = now;
                
                // Prefer magHeading (raw magnetic) over trueHeading
                // because we handle declination ourselves
                const heading = h.magHeading ?? h.trueHeading ?? 0;
                setMagneticHeading(heading);
                
                // Check accuracy (iOS provides this)
                if ('accuracy' in h && h.accuracy !== undefined) {
                  setCompassAccuracy(h.accuracy);
                  // Negative accuracy means uncalibrated
                  if (h.accuracy < 0 || h.accuracy > 25) {
                    setNeedsCalibration(true);
                  } else {
                    setNeedsCalibration(false);
                  }
                }
              }
            });
            console.log('[Qibla] Using Location.watchHeadingAsync');
          } catch (e) {
            console.warn('[location] watchHeadingAsync failed, fallback to Magnetometer', e);
          }
        }

        // Fallback to Magnetometer if Location heading not available
        if (!headingSub && Magnetometer?.addListener) {
          try {
            Magnetometer.setUpdateInterval(100); // Update every 100ms
            
            magSub = Magnetometer.addListener(data => {
              const now = Date.now();
              if (now - lastHeadingUpdate.current > 100) {
                lastHeadingUpdate.current = now;
                
                // Calculate magnetic heading from magnetometer
                let angle = (Math.atan2(data.y, data.x) * 180) / Math.PI;
                const normalized = (angle + 360) % 360;
                setMagneticHeading(normalized);
                
                // Check if calibration needed (if magnitude is too low)
                const magnitude = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
                if (magnitude < 25 || magnitude > 65) { // Typical Earth's field is ~30-60 µT
                  setNeedsCalibration(true);
                } else {
                  setNeedsCalibration(false);
                }
              }
            });
            console.log('[Qibla] Using Magnetometer fallback');
          } catch (e) {
            console.warn('[sensors] Magnetometer listener failed', e);
            setErrorMsg('Compass sensor unavailable');
          }
        }

      } catch (e) {
        console.error('[qibla] initialization failed', e);
        setErrorMsg('Failed to initialize Qibla finder. Please restart the app.');
      } finally {
        setIsLoading(false);
      }
    })();

    return () => {
      try { magSub && magSub.remove && magSub.remove(); } catch {}
      try { headingSub && headingSub.remove && headingSub.remove(); } catch {}
    };
  }, [isExpoGo]);

  const handleRecalibrate = () => {
    setNeedsCalibration(false);
    // On iOS, the system will show calibration UI automatically when needed
    // On Android, prompt user to move device in figure-8
    alert(
      Platform.OS === 'ios' 
        ? 'Move your device in a figure-8 pattern to calibrate the compass.'
        : 'Move your device in a figure-8 pattern until the compass stabilizes.'
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0f172a', '#1e3a8a', '#0f172a']} style={styles.gradient}>
        <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
          <Text style={styles.title}>🕌 Qibla Finder</Text>
          <Text style={styles.subtitle}>Align yourself towards Makkah</Text>
          
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
              {/* Calibration Warning */}
              {needsCalibration && (
                <TouchableOpacity onPress={handleRecalibrate} style={styles.calibrationWarning}>
                  <Text style={styles.calibrationText}>⚠️ Compass needs calibration</Text>
                  <Text style={styles.calibrationSubtext}>Tap to learn how</Text>
                </TouchableOpacity>
              )}

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
                      </Defs>

                      {/* Outer ring */}
                      <Circle cx={CENTER} cy={CENTER} r={CENTER - 3} fill="none" stroke="#b45309" strokeWidth="6" />
                      
                      {/* Compass face */}
                      <Circle cx={CENTER} cy={CENTER} r={CENTER - 12} fill="url(#compassFace)" stroke="#92400e" strokeWidth="2" />

                      {/* Degree markings */}
                      {Array.from({ length: 72 }).map((_, i) => {
                        const angle = (i * 5) * (Math.PI / 180);
                        const isMainDirection = i % 18 === 0;
                        const isCardinalDirection = i % 9 === 0;
                        const isMajorTick = i % 6 === 0;
                        
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

                      {/* Qibla Arrow - now using MAGNETIC coordinates */}
                      <G origin={`${CENTER}, ${CENTER}`} rotation={qiblaMagnetic}>
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
                        <G transform={`translate(${CENTER - 12}, ${CENTER - (CENTER - 100)})`}>
                          <KaabaIcon size={24} />
                        </G>
                      </G>

                      {/* Center circle */}
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
                <Text style={styles.infoText}>Qibla (Magnetic): {qiblaMagnetic.toFixed(1)}°</Text>
                <Text style={styles.infoText}>Your Heading: {magneticHeading.toFixed(1)}°</Text>
                <Text style={styles.infoText}>Difference: {Math.abs(((magneticHeading - qiblaMagnetic + 540) % 360) - 180).toFixed(1)}°</Text>
                <Text style={styles.infoTextSmall}>Declination: {magneticDeclination.toFixed(2)}°</Text>
                {compassAccuracy !== null && (
                  <Text style={styles.infoTextSmall}>Accuracy: {compassAccuracy.toFixed(1)}°</Text>
                )}
              </View>
              
              {isExpoGo && (
                <Text style={styles.mockNote}>(Mock location: Singapore)</Text>
              )}
              
              <Text style={styles.tipsText}>
                💡 Tip: Keep device flat and away from metal objects
              </Text>
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
  calibrationWarning: {
    marginTop: 10,
    marginBottom: 10,
    padding: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  calibrationText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  calibrationSubtext: {
    color: '#fde68a',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
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
    fontSize: 16, 
    fontWeight: '600', 
    color: '#f8fafc', 
    textAlign: 'center',
    marginVertical: 2,
  },
  infoTextSmall: { 
    fontSize: 12, 
    fontWeight: '500', 
    color: '#cbd5e1', 
    textAlign: 'center',
    marginVertical: 2,
  },
  mockNote: { 
    marginTop: 10, 
    fontSize: 12, 
    color: '#94a3b8', 
    fontStyle: 'italic' 
  },
  tipsText: {
    marginTop: 15,
    fontSize: 12,
    color: '#fbbf24',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});