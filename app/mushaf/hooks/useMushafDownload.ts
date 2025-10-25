

import { useCallback, useEffect, useState } from 'react';
import { checkMushafStatus, mushafDownloadService, type DownloadProgress } from '../services/mushafDownloadService';

type SimpleProgressCallback = (p: number) => void;
type RichProgressCallback = (p: DownloadProgress) => void;

export function useMushafDownload() {
  const [status, setStatus] = useState<'not-installed'|'downloading'|'ready'|'error'>('not-installed');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  // Automatic navigation removed; navigation should be triggered by user actions.

  useEffect(() => {
    checkMushafStatus().then(s => setStatus(s)).catch(() => setStatus('error'));
  }, []);

  // NOTE: we intentionally do not navigate on 'ready' here to avoid
  // unexpected route changes during app startup. The component using
  // this hook should perform navigation on explicit user interaction.

  /**
   * Start download.
   * Accepts either a legacy numeric progress callback (percentage) or a richer DownloadProgress callback.
   */
  const startDownload = useCallback(async (onProgress?: SimpleProgressCallback | RichProgressCallback) => {
    setStatus('downloading');
    setProgress(null);
    try {
      await mushafDownloadService.download((p) => {
        setProgress(p);
        if (onProgress) {
          try { (onProgress as RichProgressCallback)(p); } catch (_) { /* ignore */ }
          try { (onProgress as SimpleProgressCallback)(p.percentage); } catch (_) { /* ignore */ }
        }
      });
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      throw e;
    }
  }, []);

  const cancel = useCallback(() => {
    mushafDownloadService.cancelDownload();
    setStatus('not-installed');
    setProgress(null);
  }, []);

  useEffect(() => {
    console.log('[useMushafDownload] Status:', status);
    console.log('[useMushafDownload] Progress:', progress?.percentage);
    console.log('[useMushafDownload] Stage:', progress?.stage);
  }, [status, progress]);

  return { status, progress, startDownload, cancel };
}
