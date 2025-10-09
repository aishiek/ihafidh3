import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type TimeRange = 'day' | 'week' | 'month' | 'year';

interface Props {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
  colors: {
    primary: string;
    text: string;
    textSecondary: string;
    surface: string;
    border: string;
  };
}

const TABS: TimeRange[] = ['day','week','month','year'];

export default function TimeRangeSelector({ value, onChange, colors }: Props) {
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
      {TABS.map(t => (
        <Pressable
          key={t}
          onPress={() => onChange(t)}
          style={({ pressed }) => [
            styles.tab,
            { backgroundColor: value===t ? colors.primary : 'transparent' },
            pressed && { opacity: 0.9 }
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Select ${t} view`}
        >
          <Text style={[styles.tabText, { color: value===t ? '#fff' : colors.textSecondary }]}>{t.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection:'row', padding:2, borderRadius:10, borderWidth:1, alignItems:'center', justifyContent:'space-between', minWidth:200 },
  tab: { flex:1, paddingVertical:8, alignItems:'center', justifyContent:'center', borderRadius:6, borderWidth:0, marginHorizontal:2 },
  tabText: { fontSize:12, fontWeight:'700' },
});
