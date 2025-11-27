import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

type Props = {
  onPress?: () => void;
  onLongPress?: () => void;
  isActive?: boolean;
  style?: ViewStyle | ViewStyle[];
};

const PageModeButton: React.FC<Props> = ({ onPress, onLongPress, isActive = false, style }) => {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const bg = isActive ? '#222' : '#3a3a3a';
  const frontFill = '#FFD700';

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {showTooltip && (
        <View style={styles.tooltip} pointerEvents="none">
          <Text style={styles.tooltipText}>Page Mode</Text>
        </View>
      )}
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => setShowTooltip(true)}
        onPressOut={() => setShowTooltip(false)}
        style={[styles.iconButton, { backgroundColor: bg }, style]}
        activeOpacity={0.85}
      >
        <Svg width={40} height={40} viewBox="0 0 50 50" fill="none">
          {/* Back layer */}
          <Rect x="8" y="12" width="28" height="32" rx="2" fill="#999" opacity="0.3" />
          {/* Middle layer */}
          <Rect x="11" y="9" width="28" height="32" rx="2" fill="#ccc" opacity="0.6" />
          {/* Front page */}
          <Rect x="14" y="6" width="28" height="32" rx="2" fill={frontFill} />

          {/* Text lines */}
          <Line x1="18" y1="13" x2="36" y2="13" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
          <Line x1="18" y1="19" x2="36" y2="19" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
          <Line x1="18" y1="25" x2="32" y2="25" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
        </Svg>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  tooltip: {
    position: 'absolute',
    top: -36,
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'center',
    zIndex: 10,
  },
  tooltipText: {
    color: '#1a1a1a',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default PageModeButton;
