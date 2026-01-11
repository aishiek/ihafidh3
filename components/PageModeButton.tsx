import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';

type Props = {
  onPress?: () => void;
  onLongPress?: () => void;
  isActive?: boolean;
  style?: ViewStyle | ViewStyle[];
};

const PageModeButton: React.FC<Props> = ({ onPress, onLongPress, isActive = false, style }) => {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const bg = isActive ? '#222' : 'rgba(255, 255, 255, 0.08)';
  const frontFill = '#C5A059';

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
          {/* Text lines only - no background page */}
          <Line x1="12" y1="15" x2="38" y2="15" stroke={frontFill} strokeWidth="2.5" strokeLinecap="round" />
          <Line x1="12" y1="22" x2="38" y2="22" stroke={frontFill} strokeWidth="2.5" strokeLinecap="round" />
          <Line x1="12" y1="29" x2="38" y2="29" stroke={frontFill} strokeWidth="2.5" strokeLinecap="round" />
          <Line x1="12" y1="36" x2="38" y2="36" stroke={frontFill} strokeWidth="2.5" strokeLinecap="round" />
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
