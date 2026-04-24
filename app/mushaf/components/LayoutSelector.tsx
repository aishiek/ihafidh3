import { AVAILABLE_LAYOUTS } from '@/types/layout';
import {logAnalyticsEvent } from '@/utils/analyticsHelper';
import { router } from 'expo-router';
import { CheckCircle, Circle, Download, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LayoutService from '../services/layoutService';
import { checkLayoutStatus } from '../services/mushafDownloadService';

interface LayoutSelectorProps {
  visible: boolean;
  onClose: () => void;
  onLayoutSelected: (layoutId: string) => void;
}

const LayoutSelector: React.FC<LayoutSelectorProps> = ({ visible, onClose, onLayoutSelected }) => {
  const [activeLayoutId, setActiveLayoutId] = useState<string>('indopak_15');
  const [loading, setLoading] = useState(false);
  const [downloadedLayouts, setDownloadedLayouts] = useState<Set<string>>(new Set(['indopak_15'])); // Initialize with indopak
  const [checkingDownloads, setCheckingDownloads] = useState(false);

  useEffect(() => {
    if (visible) {
      loadActiveLayout();
      checkDownloadStatus();
    }
  }, [visible]);

  const loadActiveLayout = async () => {
    try {
      const layoutId = await LayoutService.getActiveLayoutId();
      console.log('[LayoutSelector] Active layout:', layoutId);
      setActiveLayoutId(layoutId);
    } catch (error) {
      console.error('[LayoutSelector] Error loading active layout:', error);
      setActiveLayoutId('indopak_15');
    }
  };

  const checkDownloadStatus = async () => {
    setCheckingDownloads(true);
    try {
      const downloaded = new Set<string>();
      
      for (const layout of AVAILABLE_LAYOUTS) {
        try {
          const status = await checkLayoutStatus(layout.layout_id);
          console.log(`[LayoutSelector] Layout ${layout.layout_id} status:`, status);
          if (status === 'ready') {
            downloaded.add(layout.layout_id);
          }
        } catch (error) {
          console.error(`[LayoutSelector] Error checking layout ${layout.layout_id}:`, error);
        }
      }
      
      console.log('[LayoutSelector] Downloaded layouts:', Array.from(downloaded));
      setDownloadedLayouts(downloaded);
    } catch (error) {
      console.error('[LayoutSelector] Error checking download status:', error);
    } finally {
      setCheckingDownloads(false);
    }
  };

  const handleSelectLayout = async (layoutId: string) => {
    try {
      console.log('[LayoutSelector] Selecting layout:', layoutId);
      console.log('[LayoutSelector] Downloaded layouts:', Array.from(downloadedLayouts));
      console.log('[LayoutSelector] Is downloaded:', downloadedLayouts.has(layoutId));
      
      // If not downloaded, navigate to settings to download
      if (!downloadedLayouts.has(layoutId)) {
        // ANALYTICS: Track layout download initiated
        logAnalyticsEvent('mushaf_layout_download_initiated', {
          layout_id: layoutId,
          layout_name: AVAILABLE_LAYOUTS.find(l => l.layout_id === layoutId)?.layout_name,});
        onClose(); // Close the modal first
        router.push('/mushaf/settings'); // Navigate to download page
        return;
      }

      // If it's already active, just close the modal
      if (layoutId === activeLayoutId) {
        onClose();
        return;
      }

      setLoading(true);
      const success = await LayoutService.setActiveLayout(layoutId);
      if (success) {
        // ANALYTICS: Track layout changed
        const layoutName = AVAILABLE_LAYOUTS.find(l => l.layout_id === layoutId)?.layout_name;
        const previousLayoutName = AVAILABLE_LAYOUTS.find(l => l.layout_id === activeLayoutId)?.layout_name;
        
        logAnalyticsEvent('mushaf_layout_changed', {
          layout_name: layoutName,
          previous_layout: previousLayoutName,
          trigger: 'viewer',
          from_layout_id: activeLayoutId,
          to_layout_id: layoutId,});
        
        setActiveLayoutId(layoutId);
        onLayoutSelected(layoutId);
        onClose();
      } else {
        alert('Failed to switch layout. Please try again.');
      }
    } catch (error) {
      console.error('[LayoutSelector] Error selecting layout:', error);
      alert('Error switching layout: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Mushaf Layout</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
        
        {checkingDownloads ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Checking layouts...</Text>
          </View>
        ) : (
          <ScrollView style={styles.content}>
            {AVAILABLE_LAYOUTS.map((layout) => {
              const isDownloaded = downloadedLayouts.has(layout.layout_id);
              const isActive = activeLayoutId === layout.layout_id;
              
              return (
                <TouchableOpacity
                  key={layout.layout_id}
                  style={[
                    styles.layoutCard,
                    isActive && styles.layoutCardActive,
                    !isDownloaded && styles.layoutCardDisabled
                  ]}
                  onPress={() => handleSelectLayout(layout.layout_id)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <View style={styles.layoutCardContent}>
                    <View style={styles.layoutInfo}>
                      <View style={styles.layoutHeader}>
                        <Text style={[styles.layoutName, !isDownloaded && styles.layoutNameDisabled]}>
                          {layout.layout_name}
                        </Text>
                        {isActive ? (
                          <CheckCircle size={24} color="#10b981" strokeWidth={2.5} />
                        ) : (
                          <Circle size={24} color={isDownloaded ? "#94a3b8" : "#cbd5e1"} strokeWidth={2} />
                        )}
                      </View>
                      <Text style={[styles.layoutDesc, !isDownloaded && styles.layoutDescDisabled]}>
                        {layout.layout_name_ar}
                      </Text>
                      <View style={styles.layoutMeta}>
                        <Text style={[styles.metaItem, !isDownloaded && styles.metaItemDisabled]}>
                          📄 {layout.total_pages} pages
                        </Text>
                        <Text style={[styles.metaItem, !isDownloaded && styles.metaItemDisabled]}>
                          📏 {layout.lines_per_page} lines
                        </Text>
                        <Text style={[styles.metaItem, !isDownloaded && styles.metaItemDisabled]}>
                          🗣️ {layout.narration}
                        </Text>
                      </View>
                      <Text style={[styles.layoutRegion, !isDownloaded && styles.layoutRegionDisabled]}>
                        📍 {layout.region}
                      </Text>
                      <Text style={[styles.layoutDescription, !isDownloaded && styles.layoutDescriptionDisabled]}>
                        {layout.description}
                      </Text>
                    </View>
                    {loading && isActive ? (
                      <ActivityIndicator color="#3b82f6" />
                    ) : !isDownloaded ? (
                      <View style={styles.downloadNeeded}>
                        <Download size={20} color="#f59e0b" strokeWidth={2.5} />
                        <Text style={styles.downloadText}>Download needed</Text>
                        <Text style={styles.downloadSize}>({layout.fileSize}MB)</Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#1a1a1a', 
    paddingTop: 40 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#334155',
    backgroundColor: '#0f172a',
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#ffffff' 
  },
  closeButton: { 
    padding: 8 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94a3b8',
  },
  content: { 
    flex: 1, 
    padding: 16,
    backgroundColor: '#1a1a1a',
  },
  layoutCard: { 
    backgroundColor: '#1e293b', 
    borderRadius: 12, 
    padding: 18, 
    marginBottom: 14, 
    borderWidth: 2, 
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  layoutCardActive: { 
    backgroundColor: '#1e3a5f', 
    borderColor: '#3b82f6',
    borderWidth: 2.5,
  },
  layoutCardDisabled: { 
    opacity: 1, // Keep full opacity so text is readable
    backgroundColor: '#1e293b', // Same as normal card
    borderColor: '#475569', // Slightly dimmer border
  },
  layoutCardContent: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start' 
  },
  layoutInfo: { 
    flex: 1 
  },
  layoutHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 6 
  },
  layoutName: { 
    fontSize: 17, 
    fontWeight: '700', 
    color: '#f1f5f9' 
  },
  layoutNameDisabled: {
    color: '#cbd5e1', // Bright enough to read
  },
  layoutDesc: { 
    fontSize: 15, 
    color: '#e2e8f0', 
    marginBottom: 10,
    fontWeight: '600',
  },
  layoutDescDisabled: {
    color: '#94a3b8', // Still readable
  },
  layoutMeta: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12, 
    marginBottom: 10 
  },
  metaItem: { 
    fontSize: 14, 
    color: '#cbd5e1',
    fontWeight: '600',
  },
  metaItemDisabled: {
    color: '#94a3b8', // Still readable
  },
  layoutRegion: { 
    fontSize: 13, 
    color: '#94a3b8', 
    fontWeight: '700', 
    marginBottom: 6 
  },
  layoutRegionDisabled: {
    color: '#64748b', // Dimmer but still readable
  },
  layoutDescription: { 
    fontSize: 13, 
    color: '#94a3b8', 
    fontStyle: 'italic',
    lineHeight: 16,
  },
  layoutDescriptionDisabled: {
    color: '#64748b', // Dimmer but still readable
  },
  downloadNeeded: { 
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  downloadText: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: '#fbbf24',
    marginTop: 4,
  },
  downloadSize: { 
    fontSize: 12, 
    color: '#cbd5e1',
    marginTop: 2,
    fontWeight: '600',
  },
});

export default LayoutSelector;
