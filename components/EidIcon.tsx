import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

export const EidIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ size = 24, color = '#79D7C5', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <G fill={color} stroke={color} strokeWidth={0.5}>
      <Path d="M6 9 L18 9 L18 20 C18 21 17 22 16 22 L8 22 C7 22 6 21 6 20 Z" opacity={0.9} />
      <Path d="M12 2 L14 5 L18 5 L15 8 L16 12 L12 10 L8 12 L9 8 L6 5 L10 5 Z" fill="#FFD700" stroke="#FFD700" />
    </G>
  </Svg>
);

export default EidIcon;
