import React from 'react';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

interface WBWIconProps {
  size?: number;
  color?: string;
  isActive?: boolean;
}

export const WBWIcon = ({ size = 24, color = "#D4AF37", isActive = false }: WBWIconProps) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* English bubble (Top Left) */}
      <Rect
        x="3"
        y="4"
        width="11"
        height="10"
        rx="2"
        stroke={color}
        strokeWidth="1.5"
        fill={isActive ? 'rgba(212, 175, 55, 0.1)' : 'none'}
      />
      <SvgText
        x="8.5"
        y="11.5"
        fontSize="7"
        fontWeight="bold"
        fill={color}
        textAnchor="middle"
        fontFamily="System"
      >
        A
      </SvgText>

      {/* Arabic bubble (Bottom Right) */}
      <Rect
        x="10"
        y="10"
        width="11"
        height="10"
        rx="2"
        stroke={color}
        strokeWidth="1.5"
        fill={isActive ? 'rgba(212, 175, 55, 0.15)' : 'none'}
      />
      <SvgText
        x="15.5"
        y="17.5"
        fontSize="8"
        fontWeight="bold"
        fill={color}
        textAnchor="middle"
        fontFamily="System"
      >
        ع
      </SvgText>
    </Svg>
  );
};
