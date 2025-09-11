/**
 * Mixed State Management Demo Page
 * This page demonstrates the unified theme and mixed state management approach
 * It shows how both Zustand (iHafidh2) and Context (FastingCalendar) can coexist
 */

import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import {
  Palette,
  Database,
  Layers,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Info,
  Settings,
  Moon,
  Sun,
} from 'lucide-react-native';
import { useUnifiedTheme, useThemedStyles, useConditionalTheme } from '@/hooks/useUnifiedTheme';
import { 
  useContextAwareTheme, 
  StateMigrationUtils, 
  ThemeSync, 
  FeatureIntegration,
  MixedStateConfig 
} from '@/utils/stateManagementBridge';
import { useThemeStore } from '@/store/themeStore';
import { useSettingsStore } from '@/store/settingsStore';

// Mock FastingCalendar context for demonstration
const createMockFastingContext = () => ({
  state: {
    settings: {
      theme: 'light' as const,
      colorScheme: 'blue' as const,
    }
  },
  updateSettings: async (newSettings: any) => {
    console.log('📝 FastingCalendar Context Updated:', newSettings);
    // In real implementation, this would update the actual context
    return Promise.resolve();
  }
});

export default function MixedStateManagementDemo() {
  const [fastingContextEnabled, setFastingContextEnabled] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<string>('general');
  const [demoMode, setDemoMode] = useState<'auto' | 'zustand' | 'context'>('auto');

  // Create mock fasting context when enabled
  const mockFastingContext = fastingContextEnabled ? createMockFastingContext() : undefined;

  // Get stores for direct comparison
  const zustandTheme = useThemeStore();
  const zustandSettings = useSettingsStore();

  // Unified theme with different configurations
  const unifiedTheme = useUnifiedTheme(demoMode, mockFastingContext);
  const contextAwareTheme = useContextAwareTheme(selectedFeature as any, mockFastingContext);
  const conditionalTheme = useConditionalTheme(
    selectedFeature === 'fasting',
    'context',
    'zustand'
  );

  // Feature-specific styles
  const styles = useThemedStyles((theme) => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      backgroundColor: theme.surface,
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: theme.textSecondary,
    },
    section: {
      backgroundColor: theme.surface,
      margin: 16,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    controlRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    label: {
      fontSize: 16,
      color: theme.text,
      flex: 1,
    },
    button: {
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      marginRight: 8,
    },
    buttonSecondary: {
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
    },
    buttonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 14,
    },
    buttonTextSecondary: {
      color: theme.text,
    },
    statusCard: {
      backgroundColor: theme.card,
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      borderLeftWidth: 4,
    },
    statusText: {
      fontSize: 14,
      color: theme.text,
      marginBottom: 4,
    },
    statusValue: {
      fontSize: 12,
      color: theme.textSecondary,
      fontFamily: 'monospace',
    },
    featureGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    featureChip: {
      backgroundColor: theme.surfaceElevated,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    featureChipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    featureChipText: {
      fontSize: 12,
      color: theme.text,
    },
    featureChipTextActive: {
      color: '#FFFFFF',
    },
    colorSchemeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginVertical: 8,
    },
    colorButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: theme.border,
    },
  }), demoMode);

  const handleThemeToggle = () => {
    const newTheme = unifiedTheme.isDark ? 'light' : 'dark';
    unifiedTheme.setTheme(newTheme);
  };

  const handleColorSchemeChange = (scheme: 'blue' | 'green' | 'purple' | 'orange') => {
    unifiedTheme.setColorScheme(scheme);
  };

  const handleSyncDemo = async () => {
    if (!mockFastingContext) {
      Alert.alert('Demo', 'Enable FastingCalendar Context first to see synchronization');
      return;
    }

    try {
      await StateMigrationUtils.synchronizeThemeSettings(
        zustandTheme,
        zustandSettings,
        mockFastingContext
      );
      
      Alert.alert(
        'Sync Complete! ✅',
        'Theme has been synchronized between Zustand and Context systems'
      );
    } catch (error) {
      Alert.alert('Sync Failed ❌', String(error));
    }
  };

  const handleFeatureChange = (feature: string) => {
    setSelectedFeature(feature);
    console.log(`🎯 Feature changed to: ${feature}`);
    console.log(`📊 Preferred state management: ${MixedStateConfig.getPreferredStateManagement(feature)}`);
  };

  const getStatusColor = (status: boolean) => {
    return status ? unifiedTheme.theme.success : unifiedTheme.theme.error;
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mixed State Management</Text>
        <Text style={styles.subtitle}>
          Demonstrating Zustand + Context API integration
        </Text>
      </View>

      {/* Configuration Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Settings size={20} color={unifiedTheme.theme.primary} />
          {'  '}Configuration
        </Text>

        {/* Enable/Disable FastingCalendar Context */}
        <View style={styles.controlRow}>
          <Text style={styles.label}>FastingCalendar Context</Text>
          <Switch
            value={fastingContextEnabled}
            onValueChange={setFastingContextEnabled}
            trackColor={{ false: unifiedTheme.theme.border, true: unifiedTheme.theme.primary }}
          />
        </View>

        {/* Theme Source Selection */}
        <View style={styles.controlRow}>
          <Text style={styles.label}>Theme Source</Text>
          <View style={{ flexDirection: 'row' }}>
            {(['auto', 'zustand', 'context'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.button,
                  demoMode !== mode && styles.buttonSecondary,
                  { marginLeft: 4 }
                ]}
                onPress={() => setDemoMode(mode)}
              >
                <Text style={[
                  styles.buttonText,
                  demoMode !== mode && styles.buttonTextSecondary
                ]}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Feature Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Layers size={20} color={unifiedTheme.theme.primary} />
          {'  '}Feature Context
        </Text>

        <View style={styles.featureGrid}>
          {['quran', 'fasting', 'calendar', 'quiz', 'settings', 'general'].map((feature) => {
            const isActive = selectedFeature === feature;
            const preferredState = MixedStateConfig.getPreferredStateManagement(feature);
            
            return (
              <TouchableOpacity
                key={feature}
                style={[
                  styles.featureChip,
                  isActive && styles.featureChipActive
                ]}
                onPress={() => handleFeatureChange(feature)}
              >
                <Text style={[
                  styles.featureChipText,
                  isActive && styles.featureChipTextActive
                ]}>
                  {feature} ({preferredState})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Theme Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Palette size={20} color={unifiedTheme.theme.primary} />
          {'  '}Theme Controls
        </Text>

        {/* Theme Mode Toggle */}
        <View style={styles.controlRow}>
          <Text style={styles.label}>Theme Mode</Text>
          <TouchableOpacity style={styles.button} onPress={handleThemeToggle}>
            {unifiedTheme.isDark ? <Sun size={16} color="#FFFFFF" /> : <Moon size={16} color="#FFFFFF" />}
            <Text style={styles.buttonText}>  
              {unifiedTheme.isDark ? 'Light' : 'Dark'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Color Scheme Selection */}
        <Text style={[styles.label, { marginBottom: 8 }]}>Color Scheme</Text>
        <View style={styles.colorSchemeRow}>
          <TouchableOpacity
            style={[styles.colorButton, { backgroundColor: '#2196F3' }]}
            onPress={() => handleColorSchemeChange('blue')}
          />
          <TouchableOpacity
            style={[styles.colorButton, { backgroundColor: '#4CAF50' }]}
            onPress={() => handleColorSchemeChange('green')}
          />
          <TouchableOpacity
            style={[styles.colorButton, { backgroundColor: '#9C27B0' }]}
            onPress={() => handleColorSchemeChange('purple')}
          />
          <TouchableOpacity
            style={[styles.colorButton, { backgroundColor: '#FF9800' }]}
            onPress={() => handleColorSchemeChange('orange')}
          />
        </View>

        {/* Sync Button */}
        <TouchableOpacity
          style={[styles.button, { alignSelf: 'flex-start', marginTop: 12 }]}
          onPress={handleSyncDemo}
        >
          <Text style={styles.buttonText}>🔄 Sync Themes</Text>
        </TouchableOpacity>
      </View>

      {/* Status Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Database size={20} color={unifiedTheme.theme.primary} />
          {'  '}State Information
        </Text>

        {/* Unified Theme Status */}
        <View style={[styles.statusCard, { borderLeftColor: unifiedTheme.theme.primary }]}>
          <Text style={styles.statusText}>🎨 Unified Theme</Text>
          <Text style={styles.statusValue}>Mode: {unifiedTheme.themeMode}</Text>
          <Text style={styles.statusValue}>Color: {unifiedTheme.colorScheme}</Text>
          <Text style={styles.statusValue}>Dark: {unifiedTheme.isDark.toString()}</Text>
          <Text style={styles.statusValue}>Source: {unifiedTheme.raw.context ? 'Context + Zustand' : 'Zustand'}</Text>
        </View>

        {/* Context-Aware Theme Status */}
        <View style={[styles.statusCard, { borderLeftColor: getStatusColor(!!mockFastingContext) }]}>
          <Text style={styles.statusText}>🎯 Context-Aware Theme ({selectedFeature})</Text>
          <Text style={styles.statusValue}>Primary: {contextAwareTheme.theme.primary}</Text>
          <Text style={styles.statusValue}>Background: {contextAwareTheme.theme.background}</Text>
          <Text style={styles.statusValue}>Using FastingContext: {!!mockFastingContext}</Text>
        </View>

        {/* Zustand Store Status */}
        <View style={[styles.statusCard, { borderLeftColor: unifiedTheme.theme.info }]}>
          <Text style={styles.statusText}>⚡ Zustand Stores</Text>
          <Text style={styles.statusValue}>Theme Store: {zustandTheme.colorScheme}</Text>
          <Text style={styles.statusValue}>Settings Store: {zustandSettings.theme}</Text>
          <Text style={styles.statusValue}>Theme Mode: {zustandTheme.themeMode}</Text>
        </View>

        {/* Context Status */}
        <View style={[styles.statusCard, { borderLeftColor: getStatusColor(fastingContextEnabled) }]}>
          <Text style={styles.statusText}>📋 Context Status</Text>
          <Text style={styles.statusValue}>Enabled: {fastingContextEnabled.toString()}</Text>
          <Text style={styles.statusValue}>Available: {!!mockFastingContext}</Text>
          {mockFastingContext && (
            <>
              <Text style={styles.statusValue}>Theme: {mockFastingContext.state.settings.theme}</Text>
              <Text style={styles.statusValue}>Scheme: {mockFastingContext.state.settings.colorScheme}</Text>
            </>
          )}
        </View>
      </View>

      {/* Feature Integration Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Info size={20} color={unifiedTheme.theme.primary} />
          {'  '}Integration Information
        </Text>

        <View style={[styles.statusCard, { borderLeftColor: unifiedTheme.theme.accent }]}>
          <Text style={styles.statusText}>📱 Current Feature: {selectedFeature}</Text>
          <Text style={styles.statusValue}>
            Preferred State: {MixedStateConfig.getPreferredStateManagement(selectedFeature)}
          </Text>
          <Text style={styles.statusValue}>
            Should Use Context: {FeatureIntegration.shouldUseContext(selectedFeature, !!mockFastingContext).toString()}
          </Text>
          <Text style={styles.statusValue}>
            State Source: {FeatureIntegration.getStateSource(selectedFeature, !!mockFastingContext)}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, { alignSelf: 'flex-start', marginTop: 12 }]}
          onPress={() => {
            console.log('🔍 Mixed State Configuration:', MixedStateConfig);
            Alert.alert(
              'Configuration Info',
              `Check console for detailed mixed state configuration`
            );
          }}
        >
          <Text style={styles.buttonText}>📊 Log Config</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
