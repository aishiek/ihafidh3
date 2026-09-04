import { FastingType } from '@/types/fasting';
import { safeGoBack } from '@/utils/navigationUtils';
import { ArrowLeft } from 'lucide-react-native';
import React, { useContext } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FastingCalendarContext } from '../../components/fasting/context/FastingCalendarContext';
import { useUnifiedTheme } from '../../hooks/useUnifiedTheme';

const FastingSettings: React.FC = () => {
  const { theme } = useUnifiedTheme();
  const fastingContext = useContext(FastingCalendarContext);
  React.useEffect(() => {
    // ANALYTICS: Fasting tab viewed
    const { logAnalyticsEvent} = require('@/utils/analyticsHelper');
    logAnalyticsEvent('fasting_tab_viewed', {
      tab_name: 'settings',});
  }, []);

  if (!fastingContext) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.error }}>Fasting calendar context unavailable.</Text>
      </SafeAreaView>
    );
  }

  const { state, updateSettings, loadCalendarData } = fastingContext;
  const { settings } = state;

  // Fasting types configuration (exclude Ramadan from toggle list per UX screenshot)
  const fastingTypeMeta: { type: FastingType; title: string; desc: string }[] = [
    { type: FastingType.AYYAMUL_BIDH, title: 'Ayyamul Bidh', desc: 'The 13th, 14th, and 15th of each lunar month' },
    { type: FastingType.MONDAY_THURSDAY, title: 'Mon/Thu', desc: 'Recommended weekly fasting days' },
    { type: FastingType.MUHARRAM, title: 'Muharram', desc: 'First 10 days of Muharram' },
    { type: FastingType.ASHURA, title: 'Ashura', desc: '9th and 10th of Muharram (especially recommended)' },
    { type: FastingType.ARAFAH, title: 'Day of Arafah', desc: '9th of Dhul Hijjah' },
    { type: FastingType.SHAWWAL, title: 'Shawwal', desc: 'Six days after Eid al-Fitr' },
    { type: FastingType.DHUL_HIJJAH_FIRST_TEN, title: 'First 10 Dhul Hijjah', desc: 'First 10 days of Dhul Hijjah (highly virtuous)' },
  ];

  const toggleFastingType = async (type: FastingType) => {
    const current = settings.notifications.fastingTypes[type] || {
      enabled: true,
      time: settings.notifications.defaultTime,
      beforeDays: settings.notifications.defaultBeforeDays
    };
    await updateSettings({
      notifications: {
        ...settings.notifications,
        fastingTypes: {
          ...settings.notifications.fastingTypes,
          [type]: { ...current, enabled: !current.enabled }
        }
      }
    });
  };

  const setHijriAdjustment = async (val: -1 | 0 | 1) => {
    await updateSettings({ hijriAdjustment: val });
    // Calendar will auto-reload via useEffect in FastingCalendarContext
  };

  const setGlobalBeforeDays = async (days: number) => {
    const updatedFastingTypes = Object.fromEntries(
      Object.entries(settings.notifications.fastingTypes).map(([k, v]) => [k, { ...v!, beforeDays: days }])
    );
    await updateSettings({
      notifications: {
        ...settings.notifications,
        defaultBeforeDays: days,
        fastingTypes: updatedFastingTypes
      }
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* App-style header with yellow back arrow */}
      <View style={[styles.headerBar, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => safeGoBack()} style={styles.backButton}>
          <ArrowLeft size={24} color="#FFC107" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Manage Fasting Settings</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Title removed (now in header) */}
        {/* <Text style={[styles.pageTitle, { color: theme.text }]}>Manage Fasting Settings</Text> */}
        <Text style={[styles.helperText, { color: theme.textSecondary }]}>Global notifications can be enabled/disabled from the main Settings screen. Here you can fine‑tune individual fasting type alerts and Hijri date adjustment.</Text>

        {/* FASTING TYPES */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Fasting Types</Text>
          {/* Global lead time selector */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8 }}>
              Reminder lead time (days before):
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {[0, 1, 2, 3, 4, 5].map(d => {
                const active = settings.notifications.defaultBeforeDays === d;
                return (
                  <TouchableOpacity
                    key={d}
                    disabled={!settings.notifications.enabled}
                    onPress={() => setGlobalBeforeDays(d)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderRadius: 18,
                      marginRight: 8,
                      backgroundColor: active ? theme.primary : 'transparent',
                      borderWidth: 1,
                      borderColor: active ? theme.primary : theme.border,
                      opacity: settings.notifications.enabled ? 1 : 0.4
                    }}
                  >
                    <Text style={{ color: active ? theme.background : theme.text, fontWeight: '600', fontSize: 12 }}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 6 }}>
              {settings.notifications.defaultBeforeDays === 0
                ? 'Notifications are always sent the evening before (around Maghrib/Isha) at the latest, so "0 days" still gives you time to plan before Fajr.'
                : settings.notifications.defaultBeforeDays === 1
                  ? 'Notifications will arrive the evening before, around Maghrib/Isha by default.'
                  : `Notifications will arrive ${settings.notifications.defaultBeforeDays} days before.`}
            </Text>
          </View>
          {!settings.notifications.enabled && (
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 12 }}>Global notifications are OFF. Enable them from the main Settings screen to receive these reminders.</Text>
          )}
          {fastingTypeMeta.map((f, idx) => {
            const typeConfig = settings.notifications.fastingTypes[f.type];
            const enabled = !!typeConfig?.enabled;
            return (
              <View
                key={f.type}
                style={[
                  styles.typeRow,
                  idx < fastingTypeMeta.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }
                ]}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.typeTitle, { color: theme.text }]}>{f.title}</Text>
                  <Text style={[styles.typeDesc, { color: theme.textSecondary }]}>{f.desc}</Text>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={() => toggleFastingType(f.type)}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={enabled ? theme.background : theme.textSecondary}
                  disabled={!settings.notifications.enabled}
                />
              </View>
            );
          })}
        </View>

        {/* CALENDAR / HIJRI ADJUSTMENT */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Hijri Date Adjustment</Text>
          <Text style={[styles.settingDescription, { color: theme.textSecondary, marginBottom: 12 }]}>Shift displayed Hijri dates by -1 or +1 day for local moonsighting differences.</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {([-1, 0, 1] as const).map(v => {
              const active = settings.hijriAdjustment === v;
              return (
                <TouchableOpacity
                  key={v}
                  onPress={() => setHijriAdjustment(v)}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 18,
                    borderRadius: 6,
                    marginRight: 8,
                    backgroundColor: active ? theme.primary : 'transparent',
                    borderWidth: 1,
                    borderColor: active ? theme.primary : theme.border
                  }}
                >
                  <Text style={{ color: active ? theme.background : theme.text, fontWeight: '600' }}>{v > 0 ? `+${v}` : v}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
      {/* Footer spacer to emulate tab footer area if needed */}
      <View style={styles.footerSpacer} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, borderBottomWidth: 1 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  content: { flex: 1, paddingHorizontal: 16 },
  helperText: { fontSize: 12, lineHeight: 16, marginBottom: 16 },
  section: { marginTop: 16, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  settingDescription: { fontSize: 12, lineHeight: 16 },
  typeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  typeTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  typeDesc: { fontSize: 11, lineHeight: 14 },
  bottomSpacing: { height: 32 },
  footerSpacer: { height: 12 },
});

export default FastingSettings;
