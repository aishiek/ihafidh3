import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

export const MuharramIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ size = 24, color = '#5A5A5A', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <G fill={color} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="5" y="5" width="14" height="14" rx="2" fill="#F0F0F0" stroke={color} strokeWidth="1" />
      <Path d="M8 8 H16 M8 12 H16 M8 16 H14" stroke={color} strokeWidth={1.5} />
      <Circle cx="16" cy="16" r="1.5" fill="#FF4500" stroke="#FF4500" />
    </G>
  </Svg>
);

export default MuharramIcon;
