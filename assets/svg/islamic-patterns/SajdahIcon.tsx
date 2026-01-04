import * as React from 'react';
import Svg, { Path } from 'react-native-svg';

const SajdahIcon = ({ size = 48, color = '#fff', style }: any) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <Path d="M4 18c0-2.2 1.8-4 4-4h8c2.2 0 4 1.8 4 4" stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    <Path d="M8 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={color} strokeWidth={1.4} fill="none" opacity={0.6} />
    <Path d="M6 11c0-1.6 1.4-3 3-3" stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" />
  </Svg>
);

export default React.memo(SajdahIcon);
