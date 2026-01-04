import * as React from 'react';
import Svg, { Path } from 'react-native-svg';

const ArabesqueTop = ({ color = 'rgba(255,255,255,0.4)', style }: any) => (
  <Svg width="100%" height={40} viewBox="0 0 1200 100" preserveAspectRatio="none" style={style}>
    <Path
      d="M0 80 C200 10 400 10 600 80 C800 150 1000 150 1200 80 L1200 100 L0 100 Z"
      fill={color}
      opacity={0.28}
    />
    <Path
      d="M0 60 C200 0 400 0 600 60 C800 120 1000 120 1200 60"
      stroke={color}
      strokeWidth={2}
      fill="none"
      opacity={0.42}
    />
  </Svg>
);

export default React.memo(ArabesqueTop);
