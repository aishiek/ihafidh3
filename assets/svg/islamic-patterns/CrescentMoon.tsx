import * as React from 'react';
import Svg, { Path } from 'react-native-svg';

const CrescentMoon = ({ size = 48, color = '#fff', style }: any) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <Path
      d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
      stroke={color}
      fill="none"
      strokeWidth={1.6}
    />
  </Svg>
);

export default React.memo(CrescentMoon);
