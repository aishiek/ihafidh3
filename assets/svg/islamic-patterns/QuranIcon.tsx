import * as React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

const QuranIcon = ({ size = 48, color = '#fff', style }: any) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <Rect x="3" y="5" width="18" height="14" rx="1.5" stroke={color} strokeWidth={1.4} fill="none" />
    <Path d="M6 8h12" stroke={color} strokeWidth={1.2} opacity={0.9} />
    <Path d="M6 11h12" stroke={color} strokeWidth={1.2} opacity={0.9} />
  </Svg>
);

export default React.memo(QuranIcon);
