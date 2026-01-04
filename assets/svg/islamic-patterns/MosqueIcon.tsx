import * as React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const MosqueIcon = ({ size = 48, color = '#fff', style }: any) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <Path d="M12 2 L12 6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    <Path d="M4 10 L12 4 L20 10" stroke={color} strokeWidth={1.4} fill="none" />
    <Rect x="4" y="10" width="16" height="8" rx="2" stroke={color} strokeWidth={1.4} fill="none" />
    <Circle cx="8" cy="14" r="1" fill={color} />
    <Circle cx="16" cy="14" r="1" fill={color} />
  </Svg>
);

export default React.memo(MosqueIcon);
