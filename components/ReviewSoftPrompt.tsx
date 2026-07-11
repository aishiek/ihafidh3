import { logScreenView } from '@/utils/analyticsHelper';
import { openFeedbackEmail, remindMeIn, requestNativeReview } from '@/utils/reviewPrompt';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ReviewSoftPrompt({
  visible, onClose }: { visible: boolean; onClose: () => void }) {
React.useEffect(() => {
    if (visible) {
      logScreenView('modal_reviewsoftprompt').catch(() => {});
    }
  }, [visible]);
 
  const handlePrimary = async () => {
    try {
      await requestNativeReview();
    } catch (e) {
      console.log('[ReviewSoftPrompt] request failed', e);
    } finally {
      onClose();
    }
  };

  const handleRemind = async () => {
    try {
      await remindMeIn(7);
    } catch (e) {
      console.log('[ReviewSoftPrompt] remind failed', e);
    } finally {
      onClose();
    }
  };

  const handleFeedback = async () => {
    try {
      await openFeedbackEmail('support@ihafidh.app', 'iHafidh app feedback');
    } catch (e) {
      console.log('[ReviewSoftPrompt] feedback failed', e);
    } finally {
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Is iHafidh helping your Hifdh? 📖</Text>
          <Text style={styles.body}>We’re a small team building this for the Ummah. If this app has eased your journey, could you help us by rating it? It only takes 5 seconds!</Text>

          <TouchableOpacity style={styles.primary} onPress={handlePrimary} accessibilityRole="button">
            <Text style={styles.primaryText}>Yes, I'd love to! 🌟</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondary} onPress={handleRemind} accessibilityRole="button">
            <Text style={styles.secondaryText}>Remind me in a week</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.link} onPress={handleFeedback} accessibilityRole="button">
            <Text style={styles.linkText}>I have a suggestion (Feedback)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  card: { width: '86%', backgroundColor: '#fff', borderRadius: 12, padding: 18 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  body: { fontSize: 14, color: '#333', marginBottom: 16 },
  primary: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondary: { marginTop: 10, paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  secondaryText: { color: '#111' },
  link: { marginTop: 10, alignItems: 'center' },
  linkText: { color: '#2563eb', textDecorationLine: 'underline' },
});
