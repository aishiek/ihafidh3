import * as React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Semi-random, decorative star scatter component
const StarPattern = ({ color = 'rgba(255,255,255,0.06)', width = '100%', height = 220 }: any) => (
  <View style={{ width: '100%', height }} pointerEvents="none">
    <Svg width={width} height={height} viewBox={`0 0 400 ${height}`} preserveAspectRatio="xMidYMid slice">
      <Path d="M20 30 L22 34 L26 35 L23 38 L24 42 L20 40 L16 42 L17 38 L14 35 L18 34 Z" fill={color} />
      <Path d="M80 60 L82 64 L86 65 L83 68 L84 72 L80 70 L76 72 L77 68 L74 65 L78 64 Z" fill={color} />
      <Path d="M200 40 L202 44 L206 45 L203 48 L204 52 L200 50 L196 52 L197 48 L194 45 L198 44 Z" fill={color} />
      <Path d="M320 80 L322 84 L326 85 L323 88 L324 92 L320 90 L316 92 L317 88 L314 85 L318 84 Z" fill={color} />
      <Path d="M280 20 L282 24 L286 25 L283 28 L284 32 L280 30 L276 32 L277 28 L274 25 L278 24 Z" fill={color} />
    </Svg>
  </View>
);

export default React.memo(StarPattern);
