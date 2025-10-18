import { useCallback, useEffect, useState } from 'react';
import { checkMushafStatus, downloadMushaf } from '../services/mushafDownloadService';

export function useMushafDownload() {
  const [status, setStatus] = useState<'not-installed'|'downloading'|'ready'|'error'>('not-installed');

  useEffect(() => { checkMushafStatus().then(s => setStatus(s)).catch(() => setStatus('error')); }, []);

  const startDownload = useCallback(async (onProgress?: (p:number)=>void) => {
    setStatus('downloading');
    try {
      await downloadMushaf(onProgress);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      throw e;
    }
  }, []);

  return { status, startDownload };
}
