import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, GestureResponderEvent, LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';

type SliderProps = {
  value: number;
  onChange?: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  trackColor?: string;
  filledColor?: string;
  thumbColor?: string;
  height?: number;
  thumbSize?: number;
  disabled?: boolean;
  onTouchStart?: () => void;
  onTouchEnd?: () => void;
};

/**
 * PRODUCTION-READY SLIDER COMPONENT - FIXED
 *
 * CRITICAL FIX: Proper drag offset calculation
 * - dragStartPosition now stores the INITIAL slider position when drag starts
 * - This ensures smooth, accurate dragging without position jumps
 */
export const Slider: React.FC<SliderProps> = ({
  value,
  onChange = () => { },
  onChangeEnd = () => { },
  min = 0,
  max = 100,
  step = 1,
  trackColor = '#333333',
  filledColor = '#FFD700',
  thumbColor = '#FFD700',
  height = 32,
  thumbSize = 24,
  disabled = false,
  onTouchStart = () => { },
  onTouchEnd = () => { },
}) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const isDragging = useRef(false);
  const [sliderPosition, setSliderPosition] = useState(0);
  const thumbScale = useRef(new Animated.Value(1)).current;

  // Store the initial slider position when drag starts
  const dragStartPosition = useRef(0);

  const valueToX = useCallback((val: number) => {
    if (trackWidth === 0) return 0;
    const clampedValue = Math.max(min, Math.min(max, val));
    return ((clampedValue - min) / (max - min)) * trackWidth;
  }, [trackWidth, min, max]);

  const xToValue = useCallback((x: number) => {
    if (trackWidth === 0) return min;
    const ratio = Math.max(0, Math.min(1, x / trackWidth));
    const rawValue = min + ratio * (max - min);
    if (step <= 0) return rawValue;
    return Math.round((rawValue - min) / step) * step + min;
  }, [trackWidth, min, max, step]);

  // Sync external value changes when not dragging
  useEffect(() => {
    if (!isDragging.current && trackWidth > 0) {
      const newX = valueToX(value);
      setSliderPosition(newX);
    }
  }, [value, valueToX, trackWidth]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const newWidth = e.nativeEvent.layout.width;
    if (newWidth > 0 && newWidth !== trackWidth) {
      setTrackWidth(newWidth);
      const clampedValue = Math.max(min, Math.min(max, value));
      const initialX = ((clampedValue - min) / (max - min)) * newWidth;
      setSliderPosition(initialX);
    }
  };

  const animateThumbScale = (toValue: number) => {
    Animated.spring(thumbScale, {
      toValue,
      friction: 8,
      tension: 300,
      useNativeDriver: true,
    }).start();
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    // CRITICAL: Capture the gesture before parents (ScrollView) can
    onStartShouldSetPanResponderCapture: () => !disabled,
    onMoveShouldSetPanResponderCapture: () => !disabled,

    onPanResponderGrant: (event: GestureResponderEvent) => {
      isDragging.current = true;
      onTouchStart?.();
      animateThumbScale(1.3);

      // Jump to touch position
      const touchX = event.nativeEvent.locationX;
      const newPosition = Math.max(0, Math.min(trackWidth, touchX));
      setSliderPosition(newPosition);
      dragStartPosition.current = newPosition;

      const newValue = xToValue(newPosition);
      onChange(newValue);
    },
    onPanResponderMove: (_: GestureResponderEvent, gestureState: any) => {
      if (!isDragging.current) return;

      const newPosition = Math.max(0, Math.min(trackWidth, dragStartPosition.current + gestureState.dx));
      setSliderPosition(newPosition);

      const newValue = xToValue(newPosition);
      onChange(newValue);
    },
    onPanResponderRelease: () => {
      animateThumbScale(1);

      // Fire the final commit
      const finalValue = xToValue(sliderPosition);
      onChangeEnd(finalValue);

      setTimeout(() => {
        isDragging.current = false;
        onTouchEnd?.();
      }, 100);
    },
    onPanResponderTerminate: () => {
      animateThumbScale(1);
      isDragging.current = false;
      onTouchEnd?.();
    },
    onPanResponderTerminationRequest: () => false,
  });

  const trackHeight = 6;

  return (
    <View style={[styles.container, { height }]}>
      <View
        style={styles.trackContainer}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
      >
        <View style={[styles.track, { backgroundColor: trackColor, height: trackHeight }]} />
        <View
          style={[
            styles.filledTrack,
            {
              width: sliderPosition,
              backgroundColor: filledColor,
              height: trackHeight,
            },
          ]}
        />
      </View>

      <Animated.View
        style={[
          styles.thumb,
          {
            left: sliderPosition - thumbSize / 2,
            width: thumbSize,
            height: thumbSize,
            borderRadius: thumbSize / 2,
            backgroundColor: thumbColor,
            transform: [
              { scale: thumbScale },
            ],
          },
        ]}
        pointerEvents="none"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    justifyContent: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  trackContainer: {
    width: '100%',
    justifyContent: 'center',
    height: '100%',
  },
  track: {
    width: '100%',
    height: 6,
    borderRadius: 3,
  },
  filledTrack: {
    position: 'absolute',
    left: 0,
    height: 6,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    top: 3,
    borderWidth: 3,
    borderColor: 'rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
    shadowOpacity: 0.3,
  },
});

export default Slider;