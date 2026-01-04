import React from 'react';
import Svg, { Defs, Path, Rect, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

export const RamadanIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ size = 24, color = '#FFC107', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Defs>
      <SvgLinearGradient id="ramadanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={color} stopOpacity="0.8" />
        <Stop offset="100%" stopColor={color} stopOpacity="1" />
      </SvgLinearGradient>
    </Defs>
    <Path
      d="M17 5.5C17 9.8 13.8 13.5 10 14.5C6.2 15.5 3 13.8 3 9.5C3 5.2 6.2 1.5 10 0.5C13.8 -0.5 17 1.2 17 5.5Z"
      transform="rotate(15 12 12)"
      fill="url(#ramadanGradient)"
      stroke="#fff"
      strokeWidth={0.5}
    />
    <Path d="M14 18 L10 18 C10 18 10 21 12 21 C14 21 14 18 14 18 Z" fill="#fff" opacity={0.8} />
    <Rect x={10.5} y={14} width={3} height={4} rx={1} fill="#fff" opacity={0.9} />
  </Svg>
);

export default RamadanIcon;
