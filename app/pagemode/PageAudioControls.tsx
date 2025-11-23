import { useSettingsStore } from '@/store/settingsStore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  const [repeatCount, setRepeatCount] = useState(1);

  const playbackSpeed = useSettingsStore((s) => s.playbackSpeed);

  useEffect(() => {
    const handleDownload = (p: number) => setDownloadProgress(p);
    const handleState = (s: any) => {
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
    if (!verses || !verses.length) return;

    if (isPlaying) return; // already playing

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      await manager.downloadPageAudio(verses, reciterId || useSettingsStore.getState().reciterIdentifier || 'ar.alafasy');
      setIsDownloading(false);
      await manager.playPage(repeatCount);
    } catch (err) {
      console.error('PageAudioControls: play error', err);
      setIsDownloading(false);
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
      <TouchableOpacity onPress={handlePlayPress} style={[styles.playButton, isPlaying && styles.disabled]} disabled={isPlaying}>
        <Text style={styles.playButtonText}>{isPlaying ? 'Playing…' : '▶️ Play Page'}</Text>
      </TouchableOpacity>

      {isPlaying && (
        <TouchableOpacity onPress={handlePauseResume} style={styles.inlineButton}>
          <Text>{isPaused ? '▶️ Resume' : '⏸️ Pause'}</Text>
        </TouchableOpacity>
      )}

      {isPlaying && (
        <TouchableOpacity onPress={handleStop} style={styles.inlineButton}>
          <Text>⏹️ Stop</Text>
        </TouchableOpacity>
      )}

      {isPlaying && (
        <Text style={styles.verseIndicator}>Verse {currentVerse + 1} of {verses.length}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  downloadContainer: { padding: 12, alignItems: 'center', backgroundColor: '#111', borderRadius: 8 },
  downloadText: { marginTop: 8, color: '#ddd' },
  controlsContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8 },
  playButton: { backgroundColor: '#FFD700', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  playButtonText: { color: '#111', fontWeight: '700' },
  inlineButton: { marginLeft: 8 },
  verseIndicator: { marginLeft: 12, color: '#aaa', fontSize: 12 },
  disabled: { opacity: 0.6 }
});

export default PageAudioControls;
