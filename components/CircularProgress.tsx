import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Info } from 'lucide-react-native';
import { useCustomColors } from '@/utils/themeUtils';

interface CircularProgressProps {
  size: number;
  strokeWidth: number;
  progress: number; // 0 to 100
  label: string;
  value: string;
  showPercentage?: boolean;
  progressColor?: string;
  textColor?: string;
  onInfoPress?: () => void;
}

export default function CircularProgress({
  size,
  strokeWidth,
  progress,
  label,
  value,
  showPercentage = true,
  progressColor,
  textColor = '#ffffff',
  onInfoPress,
}: CircularProgressProps) {
  const colors = useCustomColors();
  
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  
  return (
    <View style={styles.container}>
      <View style={[styles.progressContainer, { width: size, height: size }]}>
        {onInfoPress && (
          <TouchableOpacity 
            style={[styles.infoButton, { bottom: -8, zIndex: 10 }]} 
            onPress={onInfoPress}
            hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
          >
            <Info size={18} color={progressColor || colors.primary} />
          </TouchableOpacity>
        )}
        <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.border}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={progressColor || colors.primary}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        
        <View style={[styles.centerContent, { width: size * 0.7 }]}>
          <Text style={[styles.label, { color: textColor }]} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
          {showPercentage && (
            <Text style={[styles.percentage, { color: textColor }]}>
              {progress.toFixed(0)}%
            </Text>
          )}
        </View>
      </View>
      
      <View style={styles.valueContainer}>
        <Text style={[styles.value, { color: textColor }]}>
          {value.split('/')[0]}
        </Text>
        <Text style={[styles.totalValue, { color: textColor }]}>
          of {value.split('/')[1]}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginHorizontal: 4,
    flex: 1,
  },
  progressContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  percentage: {
    fontSize: 10,
    textAlign: 'center',
  },
  valueContainer: {
    alignItems: 'center',
  },
  value: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  totalValue: {
    fontSize: 12,
    textAlign: 'center',
  },
  infoButton: {
    position: 'absolute',
    backgroundColor: '#1C1C1E', // Match deep card background roughly so it overlays ring smoothly
    borderRadius: 12,
    padding: 2,
  }
}); 