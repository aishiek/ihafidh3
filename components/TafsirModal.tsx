import { getTafsirFromSource } from '@/services/tafsirService';
import { useSettingsStore } from '@/store/settingsStore';
import { useThemeStore } from '@/store/themeStore';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface TafsirModalProps {
  visible: boolean;
  onClose: () => void;
  surahId: number;
  verseNumber: number;
  supportedOrientations?: ("portrait" | "portrait-upside-down" | "landscape" | "landscape-left" | "landscape-right")[]; // Allow customizing orientations
  forceLightMode?: boolean;
}

interface TafsirData {
  scholar: string;
  text: string;
}

export default function TafsirModal({ visible, onClose, surahId, verseNumber, supportedOrientations = ['portrait'], forceLightMode }: TafsirModalProps) {
  const [tafsirData, setTafsirData] = useState<TafsirData | null>(null);
    const [sourceInfo, setSourceInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translationLanguage = useSettingsStore(s => s.translationLanguage);
  const themeMode = useThemeStore(s => s.themeMode);
  const isDark = forceLightMode !== undefined ? !forceLightMode : themeMode === 'dark';

  const title = useMemo(() => `Tafsir ${surahId}:${verseNumber}`, [surahId, verseNumber]);
  const bodyMaxHeight = useMemo(() => Math.floor(Dimensions.get('window').height * 0.6), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setTafsirData(null);
      try {
        // Use unified loader that prefers local Tamil tafsir when appropriate
        const res = await getTafsirFromSource(surahId, verseNumber, translationLanguage);
        if (cancelled) return;
        if (res && res.text) {
          setTafsirData({ scholar: res.scholar || 'Tafsir', text: res.text });
          setSourceInfo(res.source === 'local' ? 'Local' : 'Remote');
        } else {
          setError('Tafsir is not available right now.');
          setSourceInfo(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load tafsir.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (visible) load();
    return () => { cancelled = true; };
  }, [visible, surahId, verseNumber, translationLanguage]);

  return (
    <Modal 
      visible={visible} 
      transparent 
      animationType="fade" 
      onRequestClose={onClose}
      supportedOrientations={supportedOrientations}
    >
      <View style={styles.overlay}>
        {/* Backdrop to close on outside tap */}
        <Pressable style={styles.backdropFill} onPress={onClose} />
        {/* Centered card */}
        <View style={styles.centerContainer}>
          <LinearGradient
            colors={isDark ? ['rgba(40,40,40,0.95)', 'rgba(25,25,25,0.95)'] : ['rgba(255,255,255,0.98)', 'rgba(245,245,245,0.98)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.card, !isDark && { borderColor: 'rgba(0,0,0,0.1)' }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={[styles.topRightClose, !isDark && { backgroundColor: '#e5e5e5', borderColor: 'rgba(0,0,0,0.1)' }]}
              hitSlop={10}
            >
              <X size={18} color={isDark ? "#fff" : "#333"} strokeWidth={2.5} />
            </Pressable>
            <Text style={[styles.title, !isDark && { color: '#1a1a1a' }]}>{title}</Text>
            {!!tafsirData?.scholar && (
              <Text style={[styles.subtitle, !isDark && { color: '#B8860B' }]}>{tafsirData.scholar}</Text>
            )}

            <View style={styles.contentContainer}>
              {loading && (
                <View style={styles.center}>
                  <ActivityIndicator color={isDark ? "#FFD700" : "#B8860B"} />
                  <Text style={[styles.hint, !isDark && { color: '#666' }]}>Loading tafsir…</Text>
                </View>
              )}
              {!loading && error && (
                <View style={styles.center}>
                  <Text style={[styles.error, !isDark && { color: '#d32f2f' }]}>{error}</Text>
                  <Text style={[styles.hint, !isDark && { color: '#666' }]}>Try again later or check your connection.</Text>
                </View>
              )}
              {!loading && !error && tafsirData?.text && (
                <ScrollView 
                  showsVerticalScrollIndicator={true} 
                  style={[styles.scrollContainer, { maxHeight: bodyMaxHeight }]}
                  contentContainerStyle={styles.scrollContent}
                >
                  <Text style={[styles.text, !isDark && { color: '#333' }]}>{tafsirData.text}</Text>
                </ScrollView>
              )}
            </View>

            <Pressable onPress={onClose} style={[styles.closeBtn, !isDark && { backgroundColor: '#f0f0f0' }]}>
              <Text style={[styles.closeText, !isDark && { color: '#333' }]}>Close</Text>
            </Pressable>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  backdropFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  centerContainer: { width: '90%', maxWidth: 420 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', maxHeight: '85%' },
  topRightClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 100,
    elevation: 10
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#FFD700', fontSize: 12, textAlign: 'center', marginTop: 4, opacity: 0.9 },
  contentContainer: { marginTop: 12 },
  // Let content dictate height up to maxHeight
  scrollContainer: {},
  scrollContent: { paddingBottom: 12 },
  text: { color: '#F2F2F2', fontSize: 14, lineHeight: 22 },
  error: { color: '#ff8a80', textAlign: 'center', marginBottom: 6 },
  hint: { color: '#bbb', fontSize: 12, marginTop: 6 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  closeBtn: { marginTop: 12, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 18, borderRadius: 10, backgroundColor: '#333' },
  closeText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
