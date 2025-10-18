import { cacheAudioFile, getCachedAudioPath, isAudioCached } from '@/assets/database/QuranDatabase';

// Import FileSystem using dynamic require to avoid build issues
let FileSystem: any;
try {
  FileSystem = require('expo-file-system');
} catch (error) {
  console.warn('FileSystem not available:', error);
}

const AUDIO_CACHE_DIR = FileSystem?.documentDirectory ? `${FileSystem.documentDirectory}audio/` : null;
const BISMILLAH_REMOTE_URL = 'https://verses.quran.com/Bismillah.mp3';
const BISMILLAH_ID = 'bismillah';

// Ensure audio cache directory exists
export const ensureAudioCacheDir = async (): Promise<void> => {
  if (!FileSystem || !AUDIO_CACHE_DIR) {
    console.warn('FileSystem not available, skipping directory creation');
    return;
  }
  
  try {
    const dirInfo = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIR, { intermediates: true });
      console.log('Audio cache directory created');
    }
  } catch (error) {
    console.error('Error creating audio cache directory:', error);
  }
};

// Download and cache Bismillah audio
export const downloadBismillah = async (): Promise<string | null> => {
  if (!FileSystem || !AUDIO_CACHE_DIR) {
    console.warn('FileSystem not available, cannot download Bismillah');
    return null;
  }
  
  try {
    await ensureAudioCacheDir();
    
    // Check if already cached
    const cachedPath = await getCachedAudioPath(BISMILLAH_ID);
    if (cachedPath) {
      // Verify file still exists
      const fileInfo = await FileSystem.getInfoAsync(cachedPath);
      if (fileInfo.exists) {
        console.log('Bismillah already cached:', cachedPath);
        return cachedPath;
      }
    }
    
    // Download Bismillah
    const localPath = `${AUDIO_CACHE_DIR}bismillah.mp3`;
    console.log('Downloading Bismillah audio...');
    
    const downloadResult = await FileSystem.downloadAsync(BISMILLAH_REMOTE_URL, localPath);
    
    if (downloadResult.status === 200) {
      // Cache in database
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
      await cacheAudioFile(BISMILLAH_ID, 'bismillah', localPath, BISMILLAH_REMOTE_URL, fileSize);
      console.log('Bismillah downloaded and cached successfully');
      return localPath;
    } else {
      console.error('Failed to download Bismillah, status:', downloadResult.status);
      return null;
    }
  } catch (error) {
    console.error('Error downloading Bismillah:', error);
    return null;
  }
};

// Get Bismillah path (download if needed)
export const getBismillahPath = async (): Promise<string | null> => {
  if (!FileSystem) {
    console.warn('FileSystem not available');
    return null;
  }
  
  try {
    // First check cache
    const cachedPath = await getCachedAudioPath(BISMILLAH_ID);
    if (cachedPath) {
      const fileInfo = await FileSystem.getInfoAsync(cachedPath);
      if (fileInfo.exists) {
        return cachedPath;
      }
    }
    
    // Download if not cached
    return await downloadBismillah();
  } catch (error) {
    console.error('Error getting Bismillah path:', error);
    return null;
  }
};

// Initialize audio cache on app start
export const initializeAudioCache = async (): Promise<void> => {
  if (!FileSystem) {
    console.warn('FileSystem not available, skipping audio cache initialization');
    return;
  }
  
  try {
    await ensureAudioCacheDir();
    
    // Download Bismillah if not already cached
    const isBismillahCached = await isAudioCached(BISMILLAH_ID);
    if (!isBismillahCached) {
      console.log('Bismillah not cached, downloading...');
      await downloadBismillah();
    } else {
      console.log('Bismillah already cached');
    }
  } catch (error) {
    console.error('Error initializing audio cache:', error);
  }
};