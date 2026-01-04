import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

export const HajjIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ size = 24, color = '#4CAF50', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <G>
      <Rect x="7" y="7" width="10" height="10" rx="1" fill="#000000" />
      <Rect x="11" y="9" width="2" height="4" fill="#FFD700" />
      <Circle cx="12" cy="12" r="11" stroke={color} strokeWidth="1.5" fill="none" opacity="0.6" />
      <Path d="M12 2 L14 8 L20 8 L16 12 L18 18 L12 15 L6 18 L8 12 L4 8 L10 8 Z" fill={color} transform="scale(0.3) translate(30 30)" />
    </G>
  </Svg>
);

export default HajjIcon;
