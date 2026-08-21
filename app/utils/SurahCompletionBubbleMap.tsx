/**
 * SurahCompletionBubbleMap
 * ---------------------------------------------------------------------------
 * Packed-circle ("bubble") visualization of global surah memorization
 * completion count across all 114 surahs. Circle size AND color both encode
 * the completion popularity (completed_count).
 *
 * Features:
 *  - Tap a circle to see the exact surah name + completed count below the chart
 *  - Show/hide toggle with AsyncStorage persistence across sessions
 *  - Enforced minimum bubble size (r >= 12) so even 0-count surahs are easily tappable
 *  - Smart label strategy (no label for r < 14, surah # for 14 <= r < 22, short name for r >= 22)
 *  - Full accessibility support (accessibilityRole="button" + descriptive labels)
 * ---------------------------------------------------------------------------
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { hierarchy, pack } from 'd3-hierarchy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCustomColors } from '@/utils/themeUtils';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TOGGLE_KEY = 'ihafidh:surahCompletionMapVisible';

// ---------------------------------------------------------------------------
// Fallback Theme Constants
// ---------------------------------------------------------------------------
const COLORS = {
  background: '#15161C',
  card: '#1F2029',
  border: '#E8B62C',
  textPrimary: '#FFFFFF',
  textSecondary: '#B7B7C0',
  textMuted: '#8A8A94',
};

// 9-shade sequential scale, light yellow -> deep brown.
// Index 0 = lowest value, index 8 = highest value.
const SHADES = [
  '#FFF3D6',
  '#FCE2A8',
  '#F9D17B',
  '#F5BE4E',
  '#EFA827',
  '#D68A14',
  '#B06D0C',
  '#8A5209',
  '#5C3707',
];

function shadeIndexForValue(val: number, maxVal: number): number {
  if (val <= 0 || maxVal <= 0) return 0;

  // If maxVal is small (e.g. 1 to 4), don't jump straight to deep brown (index 8).
  // Instead, let 1 completion start at golden yellow (index 2: #F9D17B) and gradually darken.
  if (maxVal <= 4) {
    return Math.min(SHADES.length - 1, 1 + val);
  }

  // When maxVal > 4, scale smoothly across active indices [2..8]
  const minActiveIndex = 2;
  const maxActiveIndex = SHADES.length - 1;
  const ratio = Math.max(0, Math.min(1, val / maxVal));
  const idx = minActiveIndex + Math.floor(ratio * (maxActiveIndex - minActiveIndex));
  return Math.min(maxActiveIndex, idx);
}

function labelColorForShadeIndex(idx: number): string {
  // Light text on the darker (upper) half of the ramp, dark text on the light half.
  return idx >= 5 ? '#FFF3D6' : '#3A2606';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SurahCompletion {
  number: number; // 1-114
  name: string; // e.g. "Al-Baqarah"
  value: number; // completed_count (number of users who completed this surah)
}

interface PackLeaf {
  x: number;
  y: number;
  r: number;
  data: SurahCompletion;
}

interface Props {
  data: SurahCompletion[];
  /** Square canvas size in px. Omit to auto-fill the available width. */
  size?: number;
  /** Whether the chart starts expanded. Defaults to true. */
  defaultVisible?: boolean;
  onSelect?: (surah: SurahCompletion) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SurahCompletionBubbleMap({
  data,
  size,
  defaultVisible = true,
  onSelect,
}: Props) {
  const colors = useCustomColors();
  const [visible, setVisible] = useState(defaultVisible);
  const [measuredWidth, setMeasuredWidth] = useState(size ?? 0);
  const [selected, setSelected] = useState<SurahCompletion | null>(null);
  const isDark = colors.background === '#000000' || colors.background?.startsWith('#1') || colors.background?.startsWith('#0') || colors.text === '#FFFFFF' || colors.text === '#fff';

  useEffect(() => {
    AsyncStorage.getItem(TOGGLE_KEY).then((v) => {
      if (v !== null) setVisible(v === 'true');
    });
  }, []);

  const onCanvasLayout = useCallback(
    (e: LayoutChangeEvent) => {
      if (!size) setMeasuredWidth(e.nativeEvent.layout.width);
    },
    [size],
  );

  const canvasSize = size ?? measuredWidth;

  const { leaves, maxValue }: { leaves: PackLeaf[]; maxValue: number } = useMemo(() => {
    if (!canvasSize || data.length === 0) return { leaves: [], maxValue: 1 };

    const maxVal = Math.max(...data.map((d) => d.value ?? 0), 1);
    const maxRadius = canvasSize * 0.22;
    const minRadius = 11;

    // 1. Compress values with Math.sqrt before packing to handle long-tail distribution
    // d3-hierarchy expects a root node with a `children` array.
    const root = hierarchy<{ children: SurahCompletion[] }>(
      { children: data } as any,
    )
      .sum((d: any) => Math.sqrt(Math.max(d.value ?? 0, 1)))
      .sort((a: any, b: any) => (b.value ?? 0) - (a.value ?? 0));

    // 2. Let D3 pack them
    const packLayout = pack().size([canvasSize, canvasSize]).padding(3);

    // 3. Enforce visual minimum and maximum bounds
    const leafNodes = (packLayout(root as any).leaves() as any[]).map((leaf) => {
      const r = Math.min(Math.max(leaf.r, minRadius), maxRadius);
      return {
        x: leaf.x,
        y: leaf.y,
        r,
        data: leaf.data as SurahCompletion,
      };
    });

    return { leaves: leafNodes, maxValue: maxVal };
  }, [data, canvasSize]);

  const toggleVisible = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const nextVal = !visible;
    if (visible) setSelected(null);
    setVisible(nextVal);
    AsyncStorage.setItem(TOGGLE_KEY, String(nextVal)).catch(() => {});
  };

  const handlePress = (surah: SurahCompletion) => {
    setSelected(surah);
    onSelect?.(surah);
  };

  const getLabelText = (leaf: PackLeaf) => {
    if (leaf.r < 14) return null;
    if (leaf.r < 22) return String(leaf.data.number);
    // r >= 22: short name
    const shortName = leaf.data.name.replace(/^Al-/, '');
    return shortName.length > 8 ? shortName.slice(0, 7) + '..' : shortName;
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.card || COLORS.background, borderColor: colors.border || COLORS.card, borderWidth: 1 },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text || COLORS.textPrimary }]}>
          Memorization complete · all surahs
        </Text>
        <Pressable
          onPress={toggleVisible}
          hitSlop={8}
          style={[styles.toggleBtn, { borderColor: colors.primary || COLORS.border }]}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide completion chart' : 'Show completion chart'}
        >
          <Text style={[styles.toggleBtnText, { color: colors.primary || COLORS.border }]}>
            {visible ? 'Hide chart' : 'Show chart'}
          </Text>
        </Pressable>
      </View>

      {visible && (
        <>
          <View style={styles.canvasWrap} onLayout={onCanvasLayout}>
            {canvasSize > 0 && (
              <>
                <Svg width={canvasSize} height={canvasSize}>
                  {leaves.map((leaf) => {
                    const idx = shadeIndexForValue(leaf.data.value, maxValue);
                    const isSelected = selected?.number === leaf.data.number;
                    const labelText = getLabelText(leaf);
                    return (
                      <G
                        key={leaf.data.number}
                        onPress={() => handlePress(leaf.data)}
                      >
                        <Circle
                          cx={leaf.x}
                          cy={leaf.y}
                          r={leaf.r}
                          fill={SHADES[idx]}
                          stroke={isSelected ? colors.primary || '#3A2606' : 'transparent'}
                          strokeWidth={isSelected ? 2.5 : 0}
                          onPress={() => handlePress(leaf.data)}
                        />
                        {labelText && (
                          <SvgText
                            x={leaf.x}
                            y={leaf.y + 4}
                            fontSize={leaf.r >= 22 ? 11 : 10}
                            fontWeight={leaf.r >= 22 ? '600' : '500'}
                            fill={labelColorForShadeIndex(idx)}
                            textAnchor="middle"
                            onPress={() => handlePress(leaf.data)}
                          >
                            {labelText}
                          </SvgText>
                        )}
                      </G>
                    );
                  })}
                </Svg>
                {/* Native touch target overlays for 100% reliable Android & iOS tap response */}
                <View
                  style={[
                    StyleSheet.absoluteFillObject,
                    { width: canvasSize, height: canvasSize, alignSelf: 'center' },
                  ]}
                  pointerEvents="box-none"
                >
                  {leaves.map((leaf) => (
                    <Pressable
                      key={`touch-${leaf.data.number}`}
                      onPress={() => handlePress(leaf.data)}
                      hitSlop={2}
                      style={{
                        position: 'absolute',
                        left: leaf.x - leaf.r,
                        top: leaf.y - leaf.r,
                        width: leaf.r * 2,
                        height: leaf.r * 2,
                        borderRadius: leaf.r,
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${leaf.data.name}. Completed by ${leaf.data.value ?? 0} users.`}
                    />
                  ))}
                </View>
              </>
            )}
          </View>

          <View style={[styles.detail, { backgroundColor: isDark ? '#222222' : '#F2F2F2', borderColor: isDark ? '#383838' : '#E0E0E0', borderWidth: 1 }]}>
            <Text style={[styles.detailText, { color: isDark ? '#FFFFFF' : (colors.text || COLORS.textPrimary), fontWeight: '500' }]}>
              {selected
                ? `${selected.name} · Surah ${selected.number} · Completed by ${selected.value || 0} user${selected.value === 1 ? '' : 's'} globally`
                : 'Tap a circle to inspect completion count'}
            </Text>
          </View>

          <View style={styles.legend}>
            <Text style={[styles.legendLabel, { color: isDark ? '#CCCCCC' : (colors.text || COLORS.textMuted) }]}>
              Fewer completions
            </Text>
            <View style={styles.legendSwatches}>
              {SHADES.map((c) => (
                <View key={c} style={[styles.swatch, { backgroundColor: c }]} />
              ))}
            </View>
            <Text style={[styles.legendLabel, { color: isDark ? '#CCCCCC' : (colors.text || COLORS.textMuted) }]}>
              More completions
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
    marginRight: 8,
  },
  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  canvasWrap: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detail: {
    marginTop: 12,
    borderRadius: 10,
    padding: 10,
  },
  detailText: {
    fontSize: 13,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  legendLabel: {
    fontSize: 11,
    marginHorizontal: 6,
  },
  legendSwatches: {
    flexDirection: 'row',
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginHorizontal: 1,
  },
});
