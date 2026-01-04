import React from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';

export const MiladIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ size = 24, color = '#B03060', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <G fill={color}>
      <Circle cx="12" cy="12" r="4" fill="#FFC0CB" opacity={0.8} />
      <Path d="M12 2 L14 7 L19 6 L17 11 L22 14 L17 17 L19 22 L14 18 L12 22 L10 18 L5 22 L7 17 L2 14 L7 11 L5 6 L10 7 Z" fill={color} opacity={0.9} />
    </G>
  </Svg>
);

export default MiladIcon;
