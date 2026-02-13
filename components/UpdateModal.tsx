import { openStorePage } from '@/utils/versionUtils';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Download, X } from 'lucide-react-native';
import React from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

export type UpdateModalProps = {
  visible: boolean;
  forced?: boolean; // if true, hide the dismiss action
  currentVersion: string;
  latestVersion?: string | null;
  onClose?: () => void;
  releaseNotes?: string[];
  iosAppIdOverride?: string | null;
  androidPackageIdOverride?: string | null;
};

export default function UpdateModal({ visible, forced = false, currentVersion, latestVersion, onClose, releaseNotes, iosAppIdOverride, androidPackageIdOverride }: UpdateModalProps) {
  // Billboard mode: Always allow dismissal so users can read news/updates but continue using the app
  const canDismiss = true;

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <LinearGradient
          colors={['#1f2937', '#0b1220']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: '92%', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#334155' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#22c55e20', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <Download size={18} color="#22c55e" />
            </View>
            <Text style={{ flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' }} numberOfLines={1}>
              {latestVersion === currentVersion ? 'Announcement' : (forced ? 'Important Update' : 'Update available')}
            </Text>
            {canDismiss && (
              <Pressable onPress={onClose} hitSlop={8} style={{ padding: 6 }}>
                <X size={18} color="#94a3b8" />
              </Pressable>
            )}
          </View>

          <Text style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 20, marginBottom: 10 }}>
            {latestVersion === currentVersion
              ? 'You are running the latest version of iHafidh. Check out what’s new in this release.'
              : (forced
                ? 'A newer version is recommended. This update includes important improvements.'
                : 'A newer version of iHafidh is available. Update now for the latest features and fixes.')}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ color: '#94a3b8', fontSize: 12, marginRight: 12 }}>Current: <Text style={{ color: '#e2e8f0' }}>{currentVersion}</Text></Text>
            {latestVersion ? (
              <Text style={{ color: '#94a3b8', fontSize: 12 }}>Latest: <Text style={{ color: '#e2e8f0' }}>{latestVersion}</Text></Text>
            ) : null}
          </View>

          {Array.isArray(releaseNotes) && releaseNotes.length > 0 && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderColor: '#334155', borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 12 }}>
              <Text style={{ color: '#cbd5e1', fontSize: 13, fontWeight: '700', marginBottom: 6 }}>What’s new</Text>
              {releaseNotes.slice(0, 6).map((note, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
                  <Text style={{ color: '#22c55e', marginRight: 6 }}>•</Text>
                  <Text style={{ color: '#cbd5e1', fontSize: 13, flex: 1 }}>{note}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            {canDismiss && (
              <Pressable
                onPress={onClose}
                style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: '#334155' }}
              >
                <Text style={{ color: '#e2e8f0', fontWeight: '600' }}>Later</Text>
              </Pressable>
            )}
            <Pressable
              onPress={async () => {
                try {
                  await openStorePage({ iosAppId: iosAppIdOverride ?? undefined, androidPackageId: androidPackageIdOverride ?? undefined });
                } catch (e) {
                  console.warn('[update] openStorePage failed', e);
                }
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#22c55e' }}
            >
              <Check size={16} color="#0b1220" />
              <Text style={{ color: '#0b1220', fontWeight: '800' }}>
                {latestVersion === currentVersion ? 'View in Store' : 'Update now'}
              </Text>
            </Pressable>
          </View>


          <Text style={{ marginTop: 10, color: '#64748b', fontSize: 11, textAlign: 'right' }}>
            {Platform.OS === 'ios' ? 'Opens App Store' : 'Opens Play Store'}
          </Text>
        </LinearGradient>
      </View>
    </Modal>
  );
}
