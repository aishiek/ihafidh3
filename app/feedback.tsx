/**
 * In-app feedback screen (Sept release spec, item 10 — thumbs-down path).
 *
 * Symptom: no negative reviews exist despite a high uninstall rate, meaning
 * unhappy users are leaving silently. This screen catches that group: when a
 * user taps thumbs-down on the SadaqahPrompt, they land here instead of the
 * native App Store review dialog (Apple prohibits gating the native prompt on
 * sentiment, but choosing whether to invoke it at all is allowed — so this
 * screen never calls the native review API).
 */

import { logAnalyticsEvent } from '@/utils/analyticsHelper';
import { safeGoBack } from '@/utils/navigationUtils';
import { openFeedbackEmail } from '@/utils/reviewPrompt';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUnifiedTheme } from '../hooks/useUnifiedTheme';

export default function FeedbackScreen() {
  const { theme } = useUnifiedTheme();
  const [text, setText] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    logAnalyticsEvent('feedback_screen_viewed', {});
  }, []);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    logAnalyticsEvent('feedback_submitted', {
      has_text: trimmed.length > 0,
      length: trimmed.length,
    });

    if (trimmed.length > 0) {
      // No in-house feedback inbox exists yet — route it to support email so a
      // real person sees it, with the user's text pre-filled as the body.
      try {
        await openFeedbackEmail('support@ihafidh.app', 'iHafidh feedback', trimmed);
      } catch { /* best-effort */ }
    }

    setSubmitted(true);
    setTimeout(() => safeGoBack(), 900);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.headerBar, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => safeGoBack()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#FFC107" />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Feedback</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>What would make this better for you?</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            We read every response. No field is required — share as much or as little as {"you'd"} like.
          </Text>

          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
            multiline
            placeholder="Tell us what's not working, or what you wish iHafidh did..."
            placeholderTextColor={theme.textSecondary}
            value={text}
            onChangeText={setText}
            editable={!submitted}
            textAlignVertical="top"
          />

          <Pressable
            style={[styles.submitButton, submitted && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitted}
            accessibilityRole="button"
          >
            <Text style={styles.submitText}>{submitted ? 'Thank you!' : 'Send feedback'}</Text>
          </Pressable>

          <Pressable onPress={() => safeGoBack()} style={styles.skipAction} accessibilityRole="button">
            <Text style={[styles.skipText, { color: theme.textSecondary }]}>Not now</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, borderBottomWidth: 1 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 13, lineHeight: 18, marginBottom: 20 },
  input: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#D4AF37',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  submitText: { color: '#1a1a1a', fontSize: 16, fontWeight: '700' },
  skipAction: { alignItems: 'center', paddingVertical: 6 },
  skipText: { fontSize: 14, fontWeight: '500' },
});
