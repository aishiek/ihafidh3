// MoonPhaseCard.tsx - Reverted simple visual card for today's lunar phase
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, ClipPath, Rect } from 'react-native-svg';
import { LunarPhaseData } from '@/services/moon/lunarPhase';
import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';

interface Props { data: LunarPhaseData; }

export const MoonPhaseCard: React.FC<Props> = ({ data }) => {
  const { theme } = useUnifiedTheme();
  const illum = data.illumination; // 0..1
  const offset = (illum - 0.5) * 2; // -1..1

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
      <Text style={[styles.title, { color: theme.text }]}>Today&apos;s Moon</Text>
      <View style={styles.row}> 
        <Svg width={100} height={100}>
          <Defs>
            <LinearGradient id="moonGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#ffffff" />
              <Stop offset="100%" stopColor="#d9d9d9" />
            </LinearGradient>
            <ClipPath id="illumMask">
              <Rect x={50 - (50 * illum)} y={0} width={100 * illum} height={100} />
            </ClipPath>
          </Defs>
          <Circle cx={50} cy={50} r={48} fill="#1e293b" />
          <Circle cx={50 + offset * 8} cy={50} r={48} fill="url(#moonGrad)" clipPath={illum > 0 ? 'url(#illumMask)' : undefined} />
        </Svg>
        <View style={styles.meta}> 
          <Text style={[styles.phase, { color: theme.text }]}>{data.phaseName}</Text>
          <Text style={[styles.detail, { color: theme.textSecondary }]}>Illumination: {(illum * 100).toFixed(1)}%</Text>
          <Text style={[styles.detail, { color: theme.textSecondary }]}>Age: {data.ageDays.toFixed(1)} d</Text>
          <Text style={[styles.detail, { color: theme.textSecondary }]}>Cycle: {(data.cycleProgress*100).toFixed(1)}%</Text>
        </View>
      </View>
      <View style={styles.footerRow}>
        <View style={styles.footerCol}>
          <Text style={[styles.footerLabel, { color: theme.textSecondary }]}>Next Full</Text>
          <Text style={[styles.footerVal, { color: theme.text }]}>{data.nextFullMoon.slice(0,10)}</Text>
        </View>
        <View style={styles.footerCol}>
          <Text style={[styles.footerLabel, { color: theme.textSecondary }]}>Next New</Text>
            <Text style={[styles.footerVal, { color: theme.text }]}>{data.nextNewMoon.slice(0,10)}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card:{ padding:16, borderRadius:16, borderWidth:1 },
  title:{ fontSize:18, fontWeight:'600', marginBottom:12 },
  row:{ flexDirection:'row', alignItems:'center' },
  meta:{ marginLeft:16 },
  phase:{ fontSize:16, fontWeight:'700' },
  detail:{ fontSize:12, marginTop:2 },
  footerRow:{ flexDirection:'row', marginTop:14, justifyContent:'space-between' },
  footerCol:{ alignItems:'center', flex:1 },
  footerLabel:{ fontSize:11, textTransform:'uppercase', letterSpacing:0.5 },
  footerVal:{ fontSize:13, fontWeight:'600', marginTop:2 }
});

export default MoonPhaseCard;
