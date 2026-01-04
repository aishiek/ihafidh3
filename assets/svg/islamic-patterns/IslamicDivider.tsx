import * as React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

const IslamicDivider = ({ color = 'rgba(255,255,255,0.18)', style }: any) => (
  <Svg width="80%" height={18} viewBox="0 0 400 18" style={style} preserveAspectRatio="xMidYMid meet">
    <Rect x="0" y="8" width="400" height="2" fill={color} rx="1" />
    <Path d="M48 0 L52 8 L44 8 Z" fill={color} opacity="0.9" transform="translate(60,4)" />
    <Path d="M48 0 L52 8 L44 8 Z" fill={color} opacity="0.9" transform="translate(120,4) rotate(180 50 4)" />
  </Svg>
);

export default React.memo(IslamicDivider);
