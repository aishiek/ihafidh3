import { AVAILABLE_LAYOUTS, LayoutMetadata } from '@/types/layout';
import { getCommonParams, logAnalyticsEvent } from '@/utils/analyticsHelper';
import { router } from 'expo-router';
import { ArrowLeft, Check, Download, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import LayoutService from '../services/layoutService';
import {
    checkLayoutStatus,
    deleteLayout,
    downloadMushaf,
    getLayoutSize,
} from '../services/mushafDownloadService';

interface LayoutCardProps {
  layout: LayoutMetadata;
  isDownloaded: boolean;
  isActive: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  installedSize: number;
  onDownload: () => void;
  onDelete: () => void;
  onActivate: () => void;
}

const LayoutCard: React.FC<LayoutCardProps> = ({
  layout,
  isDownloaded,
  isActive,
  isDownloading,
  downloadProgress,
  installedSize,
  onDownload,
  onDelete,
  onActivate,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => {
        if (isDownloaded) {
          if (!isActive) onActivate();
        }
      }}
      style={[styles.layoutCard, isActive && styles.activeLayoutCard]}
    >
      <View style={styles.layoutHeader}>
        <View style={styles.layoutInfo}>
          <Text style={styles.layoutName}>{layout.layout_name}</Text>
          <Text style={styles.layoutNameAr}>{layout.layout_name_ar}</Text>
          <View style={styles.layoutMeta}>
            <Text style={styles.metaItem}>📄 {layout.total_pages} pages</Text>
            <Text style={styles.metaItem}>📏 {layout.lines_per_page} lines</Text>
            <Text style={styles.metaItem}>🗣️ {layout.narration}</Text>
          </View>
          <Text style={styles.layoutRegion}>📍 {layout.region}</Text>
          <Text style={styles.layoutDescription}>{layout.description}</Text>
          {layout.imageSource && (
            <Text style={styles.attribution}>
              Source: {layout.imageSource}
            </Text>
          )}
        </View>
      </View>

      {isActive && isDownloaded && (
        <View style={styles.activeBadge}>
          <Text style={styles.activeBadgeText}>Active</Text>
        </View>
      )}

      {isDownloading ? (
        <View style={styles.downloadProgress}>
          <ActivityIndicator color="#3b82f6" size="small" />
          <Text style={styles.progressText}>
            Downloading... {downloadProgress}%
          </Text>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${downloadProgress}%` },
              ]}
            />
          </View>
        </View>
      ) : isDownloaded ? (
        <View style={styles.downloadedSection}>
          <View style={styles.downloadedBadge}>
            <Check size={16} color="#10b981" />
            <Text style={styles.downloadedText}>Installed</Text>
          </View>
          <Text style={styles.sizeText}>{installedSize} MB</Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={onDelete}
          >
            <Trash2 size={18} color="#ef4444" />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.downloadSection}>
          <Text style={styles.downloadSizeText}>~{layout.fileSize} MB</Text>
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={onDownload}
          >
            <Download size={18} color="#ffffff" />
            <Text style={styles.downloadButtonText}>Download</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default function MushafSettings() {
  const [layoutStates, setLayoutStates] = useState<
    Record<
      string,
      {
        isDownloaded: boolean;
        isActive: boolean;
        isDownloading: boolean;
        downloadProgress: number;
        installedSize: number;
      }
    >
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLayoutStates();
  }, []);

  const loadLayoutStates = async () => {
    try {
      const states: typeof layoutStates = {};

      const activeId = await LayoutService.getActiveLayoutId();
      for (const layout of AVAILABLE_LAYOUTS) {
        try {
          const status = await checkLayoutStatus(layout.layout_id);
          const size = await getLayoutSize(layout.layout_id);
          states[layout.layout_id] = {
            isDownloaded: status === 'ready',
            isActive: layout.layout_id === activeId,
            isDownloading: false,
            downloadProgress: status === 'ready' ? 100 : 0,
            installedSize: size,
          };
        } catch (e) {
          states[layout.layout_id] = {
            isDownloaded: false,
            isActive: layout.layout_id === activeId,
            isDownloading: false,
            downloadProgress: 0,
            installedSize: 0,
          };
        }
      }

      setLayoutStates(states);
      setLoading(false);
    } catch (error) {
      console.error('Error loading layout states:', error);
      setLoading(false);
    }
  };

  const handleDownload = async (layoutId: string) => {
    try {
      const layoutName = AVAILABLE_LAYOUTS.find(l => l.layout_id === layoutId)?.layout_name;
      
      setLayoutStates((prev) => ({
        ...prev,
        [layoutId]: {
          ...prev[layoutId],
          isDownloading: true,
          downloadProgress: 0,
        },
      }));

      // ANALYTICS: Track mushaf layout download started
      logAnalyticsEvent('mushaf_layout_download_started', {
        layout_id: layoutId,
        layout_name: layoutName,
        ...getCommonParams(),
      });

      await downloadMushaf(layoutId, (progress) => {
        const capped = Math.max(0, Math.min(99, Math.round(progress || 0)));
        setLayoutStates((prev) => {
          const prevVal = prev[layoutId]?.downloadProgress ?? 0;
          const nextVal = Math.max(prevVal, capped); // ensure monotonic increase
          return {
            ...prev,
            [layoutId]: {
              ...prev[layoutId],
              isDownloading: true,
              downloadProgress: nextVal,
            },
          };
        });
      });

      // Reload state after download
      const status = await checkLayoutStatus(layoutId);
      const size = await getLayoutSize(layoutId);

      setLayoutStates((prev) => ({
        ...prev,
        [layoutId]: {
          ...prev[layoutId],
          isDownloaded: status === 'ready',
          isActive: status === 'ready' ? prev[layoutId].isActive : false,
          isDownloading: false,
          downloadProgress: status === 'ready' ? 100 : 0,
          installedSize: size,
        },
      }));

      // ANALYTICS: Track mushaf layout download completed
      if (status === 'ready') {
        logAnalyticsEvent('mushaf_layout_download_completed', {
          layout_id: layoutId,
          layout_name: layoutName,
          download_size_mb: size,
          ...getCommonParams(),
        });
      }

      Alert.alert('Success', `${layoutId} layout downloaded successfully!`);
    } catch (error) {
      console.error(`Error downloading ${layoutId}:`, error);
      
      // ANALYTICS: Track mushaf layout download failed
      logAnalyticsEvent('mushaf_layout_download_failed', {
        layout_id: layoutId,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        ...getCommonParams(),
      });
      
      setLayoutStates((prev) => ({
        ...prev,
        [layoutId]: {
          ...prev[layoutId],
          isDownloading: false,
          downloadProgress: 0,
        },
      }));

      Alert.alert(
        'Download Failed',
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  };

  const handleDelete = async (layoutId: string, layoutName: string) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete ${layoutName}? This will free up ${layoutStates[layoutId]?.installedSize || 0} MB.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // ANALYTICS: Track mushaf layout deleted
              logAnalyticsEvent('mushaf_layout_deleted', {
                layout_id: layoutId,
                layout_name: layoutName,
                freed_space_mb: layoutStates[layoutId]?.installedSize || 0,
                ...getCommonParams(),
              });

              await deleteLayout(layoutId);

              setLayoutStates((prev) => ({
                ...prev,
                [layoutId]: {
                  ...prev[layoutId],
                  isDownloaded: false,
                  isActive: false,
                  isDownloading: false,
                  downloadProgress: 0,
                  installedSize: 0,
                },
              }));

              Alert.alert('Success', `${layoutName} deleted successfully!`);
            } catch (error) {
              console.error(`Error deleting ${layoutId}:`, error);
              Alert.alert(
                'Delete Failed',
                error instanceof Error ? error.message : 'Unknown error occurred'
              );
            }
          },
        },
      ]
    );
  };

  const handleBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading layouts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mushaf Layouts</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Layouts</Text>
          <Text style={styles.sectionSubtitle}>
            Download the layouts you want to use. Each layout can be managed
            independently.
          </Text>
        </View>

        {AVAILABLE_LAYOUTS.map((layout) => (
          <LayoutCard
            key={layout.layout_id}
            layout={layout}
            isDownloaded={layoutStates[layout.layout_id]?.isDownloaded || false}
            isActive={layoutStates[layout.layout_id]?.isActive || false}
            isDownloading={layoutStates[layout.layout_id]?.isDownloading || false}
            downloadProgress={layoutStates[layout.layout_id]?.downloadProgress || 0}
            installedSize={layoutStates[layout.layout_id]?.installedSize || 0}
            onDownload={() => handleDownload(layout.layout_id)}
            onDelete={() => handleDelete(layout.layout_id, layout.layout_name)}
            onActivate={async () => {
              const success = await LayoutService.setActiveLayout(layout.layout_id);
              if (success) {
                // refresh active state
                const activeId = await LayoutService.getActiveLayoutId();
                setLayoutStates(prev => {
                  const updated = { ...prev };
                  for (const k of Object.keys(updated)) {
                    updated[k] = { ...updated[k], isActive: k === activeId };
                  }
                  return updated;
                });
                // Navigate to Mushaf and start from page 1 for a clean experience
                try { router.replace('/mushaf?pageNumber=1'); } catch (_) {}
              } else {
                Alert.alert('Activation Failed', 'Ensure the layout is fully downloaded.');
              }
            }}
          />
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Layouts are stored offline on your device
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    backgroundColor: '#000000',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  layoutCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeLayoutCard: {
    borderColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  layoutHeader: {
    marginBottom: 16,
  },
  layoutInfo: {
    flex: 1,
  },
  layoutName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  layoutNameAr: {
    fontSize: 16,
    color: '#cbd5e1',
    marginBottom: 12,
    fontFamily: 'System',
    fontWeight: '500',
  },
  layoutMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  metaItem: {
    fontSize: 13,
    color: '#e2e8f0',
    fontWeight: '500',
  },
  layoutRegion: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 8,
  },
  layoutDescription: {
    fontSize: 13,
    color: '#cbd5e1',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  attribution: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 8,
    fontStyle: 'italic',
  },
  downloadSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  downloadSizeText: {
    fontSize: 15,
    color: '#e2e8f0',
    fontWeight: '600',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  downloadButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  downloadProgress: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  progressText: {
    fontSize: 14,
    color: '#60a5fa',
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  downloadedSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  downloadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#064e3b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  activeBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: '#1e40af',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  activeBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  downloadedText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '700',
  },
  sizeText: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    marginTop: 24,
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
});
