import React from 'react';
import Svg, { G, Path, Rect } from 'react-native-svg';

export const ArafahIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ size = 24, color = '#1E90FF', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <G fill={color} stroke={color} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 4 L19 20 L5 20 L12 4 Z" fill={color} opacity={0.8} />
      <Path d="M3 21 L21 21" strokeWidth={2} />
      <Rect x="11.5" y="6" width="1" height="4" fill="#FFFFFF" />
    </G>
  </Svg>
);

export default ArafahIcon;
