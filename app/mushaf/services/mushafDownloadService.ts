import RNFS from 'react-native-fs';
import { MUSHAF_CACHE_DIR } from '../utils/mushafConstants';

export async function checkMushafStatus(): Promise<'not-installed'|'downloading'|'ready'|'error'> {
  try {
    const dbPath = `${MUSHAF_CACHE_DIR}/MushafLayout.db`;
    const exists = await RNFS.exists(dbPath);
    return exists ? 'ready' : 'not-installed';
  } catch (e) {
    console.warn('[MushafDownload] check status error', e);
    return 'error';
  }
}

export async function downloadMushaf(onProgress?: (p: number) => void): Promise<void> {
  // Placeholder: implement background downloads and extraction
  // TODO: implement download, unzip and validate
  throw new Error('Not implemented');
}

export async function deleteMushaf(): Promise<void> {
  try {
    await RNFS.unlink(MUSHAF_CACHE_DIR);
  } catch (e) {
    // ignore
  }
}

export async function getMushafSize(): Promise<number> {
  return 68; // MB (approx)
}
