import { logScreenView } from '@/utils/analyticsHelper';
import AnnouncementService from '@/services/AnnouncementService';
import { sanitizeHtml } from '@/utils/sanitizer';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Check, Gift, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import RenderHtml from 'react-native-render-html';

export type AnnouncementConfig = {
  id: string;
  active: boolean;
  priority: 'low' | 'medium' | 'high';
  type: 'seasonal' | 'feature' | 'news' | 'maintenance';
  title: string;
  contentType: 'html' | 'markdown' | 'text';
  content: string;
  imageUrl?: string;
  dismissible: boolean;
  showOnce: boolean;
  expiresAt?: string;
  actionButton?: { text: string; route: string };
};

export type AnnouncementModalProps = {
  visible: boolean;
  announcement: AnnouncementConfig | null;
  onClose: () => void;
  onAction?: () => void;
};

export default function AnnouncementModal({
  visible, announcement, onClose, onAction
}: AnnouncementModalProps) {
  React.useEffect(() => {
    if (visible) {
      logScreenView('modal_announcementmodal').catch(() => {});
    }
  }, [visible]);
  const { width } = useWindowDimensions();
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const autoCloseTimer = useRef<any | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const handleAction = useCallback(() => {
    try {
      // ✅ Clear timer FIRST to prevent double-close
      if (autoCloseTimer.current) {
        clearTimeout(autoCloseTimer.current);
        autoCloseTimer.current = null;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (announcement?.actionButton?.route) {
        try {
          router.push(announcement.actionButton.route as any);
        } catch (pushError) {
          console.warn('[AnnouncementModal] Push failed, trying replace:', pushError);
          try {
            router.replace(announcement.actionButton.route as any);
          } catch (replaceError) {
            console.error('[AnnouncementModal] Both navigation methods failed:', replaceError);
            Alert.alert('Navigation Error', 'Could not open the requested page. Please try again.');
          }
        }
      }

      onAction?.();
      onClose();
    } catch (error) {
      console.error('[AnnouncementModal] Action failed:', error);
    }
  }, [announcement?.actionButton?.route, onAction, onClose]);

  // ✅ CRITICAL FIX: Auto-close timer that marks announcement as seen
  useEffect(() => {
    try {
      if (visible && announcement && !announcement.dismissible) {
        // Clear existing timer
        if (autoCloseTimer.current) {
          clearTimeout(autoCloseTimer.current);
          autoCloseTimer.current = null;
        }

        // Initialize visible countdown for UI
        setRemainingSeconds(15);

        autoCloseTimer.current = setTimeout(() => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            // ✅ CRITICAL: Mark as seen BEFORE closing
            if (announcement.showOnce) {
              AnnouncementService.markAsSeen(announcement.id).then(() => {
                onClose();
              }).catch((err) => {
                console.error('[AnnouncementModal] markAsSeen failed:', err);
                onClose(); // Close anyway to prevent blocking user
              });
            } else {
              onClose();
            }
          } catch (e) {
            console.error('[AnnouncementModal] Auto-close failed:', e);
            onClose();
          }
        }, 15000);
      } else {
        // Reset countdown for dismissible or when not visible
        setRemainingSeconds(null);
      }
    } catch (e) {
      console.error('[AnnouncementModal] Auto-close setup failed:', e);
    }

    return () => {
      if (autoCloseTimer.current) {
        clearTimeout(autoCloseTimer.current);
        autoCloseTimer.current = null;
      }
    };
  }, [visible, announcement?.dismissible, announcement?.id, announcement?.showOnce, onClose]);

  // ✅ Optimized countdown: self-cleanup to prevent unnecessary re-renders
  useEffect(() => {
    if (remainingSeconds == null || remainingSeconds <= 0) {
      setRemainingSeconds(null);
      return;
    }

    const iv = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev == null || prev <= 1) {
          clearInterval(iv); // ✅ Self-cleanup
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(iv);
  }, [remainingSeconds != null]); // ✅ Only re-run when starting/stopping countdown

  const getIconByType = () => {
    switch (announcement?.type) {
      case 'seasonal':
        return <Gift size={20} color="#22c55e" />;
      case 'feature':
        return <Check size={20} color="#3b82f6" />;
      default:
        return <Gift size={20} color="#22c55e" />;
    }
  };

  const getGradientByType = (): readonly [string, string] => {
    switch (announcement?.type) {
      case 'seasonal':
        return ['#1f2937', '#0b1220'] as const;
      case 'feature':
        return ['#1e3a8a', '#0c1e47'] as const;
      case 'maintenance':
        return ['#7c2d12', '#3f1d0c'] as const;
      default:
        return ['#1f2937', '#0b1220'] as const;
    }
  };

  if (!announcement) return null;

  const canDismiss = announcement.dismissible;

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <LinearGradient
          colors={getGradientByType()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: '95%', maxWidth: 480, borderRadius: 20, padding: 0, borderWidth: 2, borderColor: '#334155', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(34, 197, 94, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              {getIconByType()}
            </View>
            <Text style={{ flex: 1, color: '#fff', fontSize: 19, fontWeight: '800', letterSpacing: 0.3 }} numberOfLines={2}>{announcement.title}</Text>
            {canDismiss && (
              <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }} hitSlop={12} style={{ padding: 6 }}>
                <X size={22} color="#94a3b8" />
              </Pressable>
            )}
            {/* Visible auto-close hint for non-dismissible announcements */}
            {!canDismiss && remainingSeconds != null && (
              <View style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' }}>
                <Text style={{ color: '#94a3b8', fontSize: 12 }}>Auto-closing in {remainingSeconds}s</Text>
              </View>
            )}
          </View>

          <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18 }}>
            {announcement.imageUrl && !imageError && (
              <View style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                {imageLoading && (
                  <View style={{ position: 'absolute', width: '100%', height: 200, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                    <ActivityIndicator size="large" color="#22c55e" />
                  </View>
                )}
                <Image
                  source={{ uri: announcement.imageUrl }}
                  style={{ width: '100%', height: announcement.imageUrl ? 200 : undefined, maxHeight: 250, resizeMode: 'cover' }}
                  onLoad={() => setImageLoading(false)}
                  onError={() => { setImageError(true); setImageLoading(false); }}
                  accessibilityLabel={announcement.title}
                />
              </View>
            )}

            {announcement.contentType === 'html' && (
              <RenderHtml
                contentWidth={width - 70}
                source={{ html: sanitizeHtml(announcement.content) }}
                tagsStyles={{
                  body: { color: '#cbd5e1', fontSize: 14, lineHeight: 22 },
                  h2: { color: '#22c55e', fontSize: 20, fontWeight: '700', marginBottom: 8 },
                  h3: { color: '#e2e8f0', fontSize: 16, fontWeight: '600', marginBottom: 6 },
                  p: { color: '#cbd5e1', marginBottom: 12, lineHeight: 22 },
                  ul: { color: '#cbd5e1', paddingLeft: 20 },
                  li: { color: '#cbd5e1', marginBottom: 8 },
                  a: { color: '#22c55e', textDecorationLine: 'underline' },
                  img: { borderRadius: 8, marginVertical: 12 }
                }}
              />
            )}

            {announcement.contentType === 'text' && (
              <Text style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 22 }}>{announcement.content}</Text>
            )}
          </ScrollView>

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 18, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
            {canDismiss && (
              <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }} style={{ paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: '#334155' }}>
                <Text style={{ color: '#e2e8f0', fontWeight: '600', fontSize: 15 }}>Close</Text>
              </Pressable>
            )}

            {announcement.actionButton && (
              <Pressable onPress={handleAction} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#22c55e', shadowColor: '#22c55e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}>
                <Check size={18} color="#0b1220" />
                <Text style={{ color: '#0b1220', fontWeight: '800', fontSize: 15 }}>{announcement.actionButton.text}</Text>
              </Pressable>
            )}
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}
