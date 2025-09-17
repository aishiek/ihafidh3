import { StyleProp, ViewStyle } from 'react-native';

// Attempt to require expo-symbols defensively so build/runtime doesn't crash if unavailable
let ExpoSymbols: any = null;
try {
  ExpoSymbols = require('expo-symbols');
} catch (e) {
  // silently ignore; component will fallback
}

const SymbolView: any = ExpoSymbols?.SymbolView;
const SymbolWeight: any = ExpoSymbols?.SymbolWeight;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
}: {
  name: string;
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  weight?: any;
}) {
  if (!SymbolView) {
    // Fallback rendering (simple colored square) when expo-symbols not present
    return (
      <div style={{ width: size, height: size, backgroundColor: color, borderRadius: 4 }} />
    ) as any;
  }
  return (
    <SymbolView
      weight={weight}
      tintColor={color}
      resizeMode="scaleAspectFit"
      name={name as any}
      style={[
        {
          width: size,
          height: size,
        },
        style,
      ]}
    />
  );
}
