import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
// Lightweight fallback slider UI (avoids dependency on @react-native-community/slider)
import { TouchableOpacity } from 'react-native';
import { TAJWEED_COLORS, TajweedConfig, TajweedRule } from '../../../types/tajweed';

interface TajweedSettingsProps {
  config: TajweedConfig;
  onConfigChange: (config: TajweedConfig) => void;
  visible?: boolean;
  onClose?: () => void;
}

export const TajweedSettings: React.FC<TajweedSettingsProps> = ({
  config,
  onConfigChange,
  visible = true,
  onClose,
}) => {
  const [localConfig, setLocalConfig] = useState<TajweedConfig>(config);

  if (!visible) return null;

  const handleToggleEnabled = (enabled: boolean) => {
    const newConfig = { ...localConfig, enabled };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleToggleRule = (rule: TajweedRule) => {
    const rules = localConfig.highlightedRules.includes(rule)
      ? localConfig.highlightedRules.filter((r) => r !== rule)
      : [...localConfig.highlightedRules, rule];

    const newConfig = { ...localConfig, highlightedRules: rules };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleToggleLabels = (showLabels: boolean) => {
    const newConfig = { ...localConfig, showLabels };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleOpacityChange = (opacity: number) => {
    const newConfig = { ...localConfig, opacity };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleStyleChange = (style: string) => {
    const newConfig = { ...localConfig, style } as TajweedConfig;
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Tajweed Settings</Text>

      {/* Master Enable/Disable */}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Enable Tajweed Highlighting</Text>
        <Switch
          value={localConfig.enabled}
          onValueChange={handleToggleEnabled}
        />
      </View>

      {localConfig.enabled && (
        <>
          {/* Show Labels Toggle */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Show Rule Labels</Text>
            <Switch
              value={localConfig.showLabels}
              onValueChange={handleToggleLabels}
            />
          </View>

          {/* Rule Toggles */}
          <Text style={styles.sectionTitle}>Highlight Rules:</Text>
          {Object.values(TajweedRule).map((rule) => (
            <View key={rule} style={styles.ruleCard}>
              <View
                style={[
                  styles.colorIndicator,
                  { backgroundColor: TAJWEED_COLORS[rule as TajweedRule].hexColor },
                ]}
              />
              <View style={styles.ruleInfo}>
                <Text style={styles.ruleName}>
                  {TAJWEED_COLORS[rule as TajweedRule].description}
                </Text>
                <Text style={styles.ruleArabic}>
                  {TAJWEED_COLORS[rule as TajweedRule].arDescription}
                </Text>
              </View>
              <Switch
                value={localConfig.highlightedRules.includes(rule as TajweedRule)}
                onValueChange={() => handleToggleRule(rule as TajweedRule)}
              />
            </View>
          ))}

          {/* Opacity Control */}
          <Text style={styles.sectionTitle}>
            Highlight Opacity: {(localConfig.opacity * 100).toFixed(0)}%
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={() => handleOpacityChange(Math.max(0.3, localConfig.opacity - 0.1))} style={styles.smallBtn}><Text style={styles.smallBtnText}>-</Text></TouchableOpacity>
            <Text>{Math.round(localConfig.opacity * 100)}%</Text>
            <TouchableOpacity onPress={() => handleOpacityChange(Math.min(1, localConfig.opacity + 0.1))} style={styles.smallBtn}><Text style={styles.smallBtnText}>+</Text></TouchableOpacity>
          </View>

          {/* Style Selection */}
          <Text style={styles.sectionTitle}>Rendering Style</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => handleStyleChange('overlay')}
              style={[styles.styleBtn, localConfig.style !== 'rq-color' ? styles.styleBtnActive : null]}
            >
              <Text style={styles.styleBtnText}>Overlay</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleStyleChange('rq-color')}
              style={[styles.styleBtn, localConfig.style === 'rq-color' ? styles.styleBtnActive : null]}
            >
              <Text style={styles.styleBtnText}>RQ Color Images</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1f2937',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  rowLabel: {
    fontSize: 16,
    color: '#374151',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 20,
    color: '#1f2937',
  },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  colorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 12,
  },
  ruleInfo: {
    flex: 1,
  },
  ruleName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  ruleArabic: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  smallBtn: { width: 36, height: 36, borderRadius: 6, backgroundColor: '#0ea5a4', alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { color: '#fff', fontWeight: '700' }
  ,
  styleBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#e5e7eb', borderRadius: 8 },
  styleBtnActive: { backgroundColor: '#0ea5a4' },
  styleBtnText: { color: '#0f172a', fontWeight: '600' }
});
