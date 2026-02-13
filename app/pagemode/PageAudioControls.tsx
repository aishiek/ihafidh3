import MushafRepeatModal from '@/components/MushafRepeatModal';
import { useSettingsStore } from '@/store/settingsStore';
import { Infinity as InfinityIcon, RefreshCw } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { VerseRef, getPageAudioManager } from '../audio/PageAudioManager';

interface PageAudioControlsProps {
  verses: VerseRef[];
  reciterId?: string;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

export const PageAudioControls: React.FC<PageAudioControlsProps> = ({ verses, reciterId, onPlayStateChange }) => {
  // Use shared singleton manager for page-mode audio
  const manager = getPageAudioManager();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentVerse, setCurrentVerse] = useState(0);
  const [showRepeatModal, setShowRepeatModal] = useState(false);

  const playbackSpeed = useSettingsStore((s) => s.playbackSpeed);
  const mushafRepeatMode = useSettingsStore((s) => s.mushafRepeatMode);
  const mushafInfiniteLoop = useSettingsStore((s) => s.mushafInfiniteLoop);
  const mushafRepeatScope = useSettingsStore((s) => s.mushafRepeatScope);

  useEffect(() => {
    const handleDownload = (p: number) => setDownloadProgress(p);
    const handleState = (s: { isPlaying: boolean; isPaused: boolean }) => {
      setIsPlaying(s.isPlaying);
      setIsPaused(s.isPaused);
      onPlayStateChange?.(s.isPlaying);
    };
    const handleVerseStart = (idx: number) => setCurrentVerse(idx);
    const handlePageComplete = () => { setIsPlaying(false); setCurrentVerse(0); };
    const handleError = (e: Error) => {
      console.error('PageAudioControls: playback error', e);
      setIsDownloading(false);
      setIsPlaying(false);
      setIsPaused(false);
    };

    manager.addDownloadProgressListener(handleDownload);
    manager.addStateListener(handleState);
    manager.addVerseStartListener(handleVerseStart);
    manager.addPageCompleteListener(handlePageComplete);
    manager.addErrorListener(handleError);

    return () => {
      // Only remove listeners here — do not call cleanup (centralized lifecycle)
      manager.removeDownloadProgressListener(handleDownload);
      manager.removeStateListener(handleState);
      manager.removeVerseStartListener(handleVerseStart);
      manager.removePageCompleteListener(handlePageComplete);
      manager.removeErrorListener(handleError);
    };
  }, [manager, onPlayStateChange]);

  const handlePlayPress = async () => {
    if (!verses?.length || isPlaying || isDownloading) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      await manager.downloadPageAudio(verses, reciterId || useSettingsStore.getState().reciterIdentifier || 'ar.alafasy');
      setIsDownloading(false);
      // Use mushaf-specific repeat settings
      const repeatCount = mushafInfiniteLoop ? 0 : mushafRepeatMode;
      await manager.playPage(repeatCount, playbackSpeed, mushafRepeatScope);
    } catch (err) {
      console.error('PageAudioControls: play error', err);
      setIsDownloading(false);
      Alert.alert('Playback Error', 'Failed to load audio. Please try again.');
    }
  };

  const handlePauseResume = async () => {
    if (isPaused) await manager.resume();
    else await manager.pause();
  };

  const handleStop = async () => { await manager.stop(); setIsPlaying(false); setIsPaused(false); };

  // Render
  if (isDownloading) {
    return (
      <View style={styles.downloadContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.downloadText}>Downloading audio... {Math.round(downloadProgress)}%</Text>
      </View>
    );
  }

  return (
    <View style={styles.controlsContainer}>
      <TouchableOpacity
        onPress={handlePlayPress}
        style={[styles.playButton, isPlaying && styles.disabled]}
        disabled={isPlaying}
        accessibilityLabel={isPlaying ? 'Audio playing' : 'Play page audio'}
        accessibilityRole="button"
      >
        <Text style={styles.playButtonText}>{isPlaying ? 'Playing…' : '▶️ Play Page'}</Text>
      </TouchableOpacity>

      {/* Repeat Mode Button */}
      <TouchableOpacity
        onPress={() => setShowRepeatModal(true)}
        style={styles.repeatButton}
        accessibilityLabel={mushafInfiniteLoop ? 'Repeat mode: infinite loop' : `Repeat mode: ${mushafRepeatMode} times`}
        accessibilityRole="button"
        accessibilityHint="Tap to change repeat settings"
      >
        {mushafInfiniteLoop ? (
          <InfinityIcon size={16} color="#1a1a1a" />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <RefreshCw size={16} color="#1a1a1a" />
            <Text style={styles.repeatBadge}>{mushafRepeatMode}</Text>
          </View>
        )}
      </TouchableOpacity>

      {isPlaying && (
        <TouchableOpacity
          onPress={handlePauseResume}
          style={styles.inlineButton}
          accessibilityLabel={isPaused ? 'Resume playback' : 'Pause playback'}
          accessibilityRole="button"
        >
          <Text>{isPaused ? '▶️ Resume' : '⏸️ Pause'}</Text>
        </TouchableOpacity>
      )}

      {isPlaying && (
        <TouchableOpacity
          onPress={handleStop}
          style={styles.inlineButton}
          accessibilityLabel="Stop playback"
          accessibilityRole="button"
        >
          <Text>⏹️ Stop</Text>
        </TouchableOpacity>
      )}

      {isPlaying && (
        <View style={styles.verseIndicatorContainer}>
          <Text style={styles.verseIndicator}>{currentVerse + 1} of {verses.length}</Text>
        </View>
      )}

      <MushafRepeatModal visible={showRepeatModal} onClose={() => setShowRepeatModal(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  downloadContainer: { padding: 12, alignItems: 'center', backgroundColor: '#111', borderRadius: 8 },
  downloadText: { marginTop: 8, color: '#ddd' },
  controlsContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 },
  playButton: { backgroundColor: '#FFD700', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  playButtonText: { color: '#111', fontWeight: '700' },
  repeatButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatBadge: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '700',
  },
  inlineButton: { marginLeft: 8 },
  verseIndicatorContainer: { alignItems: 'center', minWidth: 40 },
  verseIndicator: { color: '#aaa', fontSize: 12 },
  disabled: { opacity: 0.6 }
});

export default PageAudioControls;
