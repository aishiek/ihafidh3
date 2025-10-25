import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';
import { MUSHAF_CACHE_DIR } from '../utils/mushafConstants';

/**
 * FIXED: Mushaf Download Service - iOS File Handling Issue
 * 
 * Issue: File downloads but disappears before extraction (race condition)
 * Solution: Add delays, verify file exists between operations, sync file system
 */

const GITHUB_RELEASE_BASE = 'https://github.com/aishiek/ihafidh3/releases/download/Mushaf';

export const MUSHAF_DOWNLOAD_URLS = {
  db: `${GITHUB_RELEASE_BASE}/mushaf-db.zip`,
  layouts: `${GITHUB_RELEASE_BASE}/mushaf-layouts.zip`,
  images: `${GITHUB_RELEASE_BASE}/mushaf-images.zip`
};

export interface DownloadProgress {
  total: number;
  current: number;
  percentage: number;
  stage: 'database' | 'layouts' | 'images' | 'extracting' | 'complete';
  statusMessage: string;
  error?: string;
}

class MushafDownloadService {
  private isDownloading = false;
  private currentJobId: number | null = null;
  private cancelled = false;

  private log(tag: string, message: string, ...args: any[]) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] [${tag}]`, message, ...args);
  }

  private logError(tag: string, message: string, error?: any) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const errorMsg = error?.message || JSON.stringify(error) || String(error);
    console.error(`[${timestamp}] [${tag}] ❌`, message, errorMsg);
  }

  async isInstalled(): Promise<boolean> {
    try {
      this.log('CHECK', 'Checking if Mushaf is installed...');
      
      const dbExists = await RNFS.exists(`${MUSHAF_CACHE_DIR}/qudratullah-indopak-15-lines.db`);
      
      // Check page coordinate JSON files
      let pageJsonCount = 0;
      const jsonDir = `${MUSHAF_CACHE_DIR}/json`;
      if (await RNFS.exists(jsonDir)) {
        try {
          const jsonContents = await RNFS.readDir(jsonDir);
          const pageJsonFiles = jsonContents.filter((f: any) => f.isFile && /^\d+\.json$/.test(f.name));
          pageJsonCount = pageJsonFiles.length;

          // Debug: on first run, dump the directory structure when counts are suspicious
          const isDev = (typeof __DEV__ !== 'undefined' && __DEV__ === true);
          if (isDev) {
            if (pageJsonCount > 0 && pageJsonCount < 50) {
              this.log('CHECK', `⚠️  DEBUG: Found ${pageJsonCount} page JSON files. Expected 610.`);
              const fileList = pageJsonFiles.slice(0, 10).map((f: any) => f.name).join(', ');
              this.log('CHECK', `Sample files: ${fileList}...`);
            } else {
              this.log('CHECK', `Found ${pageJsonCount}/610 page JSON files`);
            }
          }
        } catch (e) {
          this.logError('CHECK', 'Failed to read json directory', e);
        }
      } else {
        this.log('CHECK', `⚠️  JSON directory does not exist at ${jsonDir}`);
      }

      // Check images count
      let imageCount = 0;
      const imagesDir = `${MUSHAF_CACHE_DIR}/images`;
      if (await RNFS.exists(imagesDir)) {
        try {
          const files = await RNFS.readDir(imagesDir);
          const imageFiles = files.filter((f: any) => f.isFile && (f.name.endsWith('.png') || f.name.endsWith('.jpg') || f.name.endsWith('.jpeg')));
          imageCount = imageFiles.length;

          if (typeof __DEV__ !== 'undefined' && __DEV__ === true) {
            if (imageCount < 50) {
              this.log('CHECK', `⚠️  DEBUG: Found ${imageCount} images. Expected 610.`);
              const imageList = imageFiles.slice(0, 10).map((f: any) => f.name).join(', ');
              this.log('CHECK', `Sample images: ${imageList}...`);
            } else {
              this.log('CHECK', `Found ${imageCount}/610 page images`);
            }
          }
        } catch (e) {
          this.logError('CHECK', 'Failed to read images directory', e);
        }
      } else {
        this.log('CHECK', `⚠️  Images directory does not exist at ${imagesDir}`);
      }

      // Strict check: require full 610-page install
      const isComplete = dbExists && pageJsonCount >= 610 && imageCount >= 610;
      
      if (isComplete) {
        this.log('CHECK', `✅ Mushaf fully installed: DB ✓, ${pageJsonCount} pages ✓, ${imageCount} images ✓`);
        return true;
      } else {
        this.log('CHECK', `❌ Installation incomplete. DB: ${dbExists}, Pages: ${pageJsonCount}/610, Images: ${imageCount}/610`);
        return false;
      }
    } catch (e) {
      this.logError('CHECK', 'isInstalled check failed', e);
      return false;
    }
  }

  async getInstalledSize(): Promise<number> {
    try {
      let total = 0;

      // DB file
      const dbPath = `${MUSHAF_CACHE_DIR}/qudratullah-indopak-15-lines.db`;
      if (await RNFS.exists(dbPath)) {
        const s = await RNFS.stat(dbPath);
        total += Number(s.size || 0);
        if (typeof __DEV__ !== 'undefined' && __DEV__ === true) this.log('SIZE', `DB: ${Math.round(Number(s.size || 0) / (1024 * 1024))}MB`);
      }

      // Page coordinate JSON files
      const jsonDir = `${MUSHAF_CACHE_DIR}/json`;
      if (await RNFS.exists(jsonDir)) {
        try {
          const jsonFiles = await RNFS.readDir(jsonDir);
          let jsonTotal = 0;
          for (const f of jsonFiles) {
            if (f.isFile && /^\d+\.json$/.test(f.name)) {
              const s = await RNFS.stat(f.path);
              jsonTotal += Number(s.size || 0);
            }
          }
          total += jsonTotal;
          if (typeof __DEV__ !== 'undefined' && __DEV__ === true) this.log('SIZE', `JSON pages: ${Math.round(jsonTotal / (1024 * 1024))}MB`);
        } catch (e) {
          this.logError('SIZE', 'Failed to calculate json size', e);
        }
      }

      // Page images
      const imagesDir = `${MUSHAF_CACHE_DIR}/images`;
      if (await RNFS.exists(imagesDir)) {
        try {
          const files = await RNFS.readDir(imagesDir);
          let imagesTotal = 0;
          for (const f of files) {
            if (f.isFile) {
              const s = await RNFS.stat(f.path);
              imagesTotal += Number(s.size || 0);
            }
          }
          total += imagesTotal;
          if (typeof __DEV__ !== 'undefined' && __DEV__ === true) this.log('SIZE', `Images: ${Math.round(imagesTotal / (1024 * 1024))}MB`);
        } catch (e) {
          this.logError('SIZE', 'Failed to calculate images size', e);
        }
      }

      const sizeInMB = Math.round(total / (1024 * 1024));
      this.log('SIZE', `═══ Total: ${sizeInMB}MB`);
      return sizeInMB;
    } catch (e) {
      this.logError('SIZE', 'getInstalledSize failed', e);
      return 0;
    }
  }

  cancelDownload() {
    this.log('CANCEL', 'Download cancellation requested');
    this.cancelled = true;
    try {
      if (this.currentJobId != null && (RNFS as any).stopDownload) {
        (RNFS as any).stopDownload(this.currentJobId);
        this.log('CANCEL', '✅ Stopped download job', this.currentJobId);
      }
    } catch (e) {
      this.logError('CANCEL', 'Best-effort stop failed', e);
    }
  }

  async delete(): Promise<void> {
    try {
      this.log('DELETE', 'Deleting Mushaf cache directory...');
      if (await RNFS.exists(MUSHAF_CACHE_DIR)) {
        await RNFS.unlink(MUSHAF_CACHE_DIR);
        this.log('DELETE', '✅ Cache deleted');
      }
    } catch (e) {
      this.logError('DELETE', 'Failed to delete cache', e);
    }
  }

  private async ensureCacheDir(): Promise<void> {
    try {
      this.log('SETUP', `Ensuring cache dir exists: ${MUSHAF_CACHE_DIR}`);
      
      if (!(await RNFS.exists(MUSHAF_CACHE_DIR))) {
        await RNFS.mkdir(MUSHAF_CACHE_DIR, { mkdirs: true });
        this.log('SETUP', '✅ Created cache directory');
      }

      const jsonDir = `${MUSHAF_CACHE_DIR}/json`;
      if (!(await RNFS.exists(jsonDir))) {
        await RNFS.mkdir(jsonDir, { mkdirs: true });
        this.log('SETUP', '✅ Created json directory');
      }

      // New: create mushaf-layouts dir for the canonical layout JSON
      const mushafLayoutsDir = `${MUSHAF_CACHE_DIR}/mushaf-layouts`;
      if (!(await RNFS.exists(mushafLayoutsDir))) {
        await RNFS.mkdir(mushafLayoutsDir, { mkdirs: true });
        this.log('SETUP', '✅ Created mushaf-layouts directory');
      }

      const imagesDir = `${MUSHAF_CACHE_DIR}/images`;
      if (!(await RNFS.exists(imagesDir))) {
        await RNFS.mkdir(imagesDir, { mkdirs: true });
        this.log('SETUP', '✅ Created images directory');
      }
    } catch (e) {
      this.logError('SETUP', 'Failed to ensure directories', e);
      throw new Error(`Directory setup failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private async waitForFile(filePath: string, maxWaitMs: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 200; // Check every 200ms

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const exists = await RNFS.exists(filePath);
        if (exists) {
          const stat = await RNFS.stat(filePath);
          const size = Number(stat.size || 0);
          if (size > 0) {
            this.log('WAIT', `✅ File appeared: ${filePath} (${size} bytes)`);
            return true;
          }
        }
      } catch (e) {
        // Keep trying
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    this.log('WAIT', `❌ Timeout waiting for file: ${filePath}`);
    return false;
  }

    // Search for a filename anywhere under the cache dir up to a max depth
    private async findFileInCache(fileName: string, dir: string = MUSHAF_CACHE_DIR, maxDepth: number = 4): Promise<string | null> {
      try {
        const entries = await RNFS.readDir(dir);
        for (const e of entries) {
          if (e.isFile && e.name === fileName) return e.path;
        }

        if (maxDepth <= 0) return null;

        for (const e of entries) {
          if (e.isDirectory) {
            try {
              const found = await this.findFileInCache(fileName, e.path, maxDepth - 1);
              if (found) return found;
            } catch (inner) {
              // ignore and continue
            }
          }
        }
      } catch (e) {
        // ignore
      }

      return null;
    }

    // Recursively collect files matching a predicate under a directory (limited depth)
    private async findAllFiles(dir: string, predicate: (name: string) => boolean, maxDepth: number = 6): Promise<string[]> {
      const results: string[] = [];
      try {
        const entries = await RNFS.readDir(dir);
        for (const e of entries) {
          try {
            if (e.isFile && predicate(e.name)) results.push(e.path);
            else if (e.isDirectory && maxDepth > 0) {
              const nested = await this.findAllFiles(e.path, predicate, maxDepth - 1);
              results.push(...nested);
            }
          } catch (inner) {
            // ignore
          }
        }
      } catch (e) {
        // ignore
      }
      return results;
    }

  private async extractArchive(
    archivePath: string,
    extractionTarget: string,
    archiveName: string
  ): Promise<void> {
    let lastError: any = null;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.log('EXTRACT', `Attempt ${attempt}/${maxAttempts}: Extracting ${archiveName}`);

        // Critical: Wait for file to exist and be readable
        const fileReady = await this.waitForFile(archivePath, 5000);
        if (!fileReady) {
          throw new Error('Archive file never appeared on disk');
        }

        // Add small delay before extraction
        await new Promise(resolve => setTimeout(resolve, 500));

        const stat = await RNFS.stat(archivePath);
        const size = Number(stat.size || 0);
        this.log('EXTRACT', `File ready for extraction: ${Math.round(size / 1024)}KB`);

        if (size < 512) {
          throw new Error(`File too small to extract: ${size} bytes`);
        }

        // Attempt unzip
        const result = await unzip(archivePath, extractionTarget);
        this.log('EXTRACT', `✅ Extraction successful`);

        // Verify extraction
        try {
          const files = await RNFS.readDir(extractionTarget);
               this.log('EXTRACT', `Extracted files: ${files.map((f: any) => f.name).join(', ')}`);
        } catch (e) {
          this.log('EXTRACT', 'Could not list files (non-critical)', e);
        }

        // Safe cleanup - try to remove archive
        try {
          await RNFS.unlink(archivePath);
          this.log('EXTRACT', `✅ Removed archive: ${archiveName}`);
        } catch (e) {
          this.log('EXTRACT', `⚠️  Could not remove archive (will retry next time)`, e);
        }

        // Post-extraction normalization: if we just extracted layouts, ensure canonical folder
        try {
          // Normalize numeric page JSON files (1.json..610.json) and images into canonical dirs
          const canonicalJsonDir = `${MUSHAF_CACHE_DIR}/json`;
          const canonicalImagesDir = `${MUSHAF_CACHE_DIR}/images`;

          // Ensure canonical dirs exist
          if (!(await RNFS.exists(canonicalJsonDir))) await RNFS.mkdir(canonicalJsonDir, { mkdirs: true });
          if (!(await RNFS.exists(canonicalImagesDir))) await RNFS.mkdir(canonicalImagesDir, { mkdirs: true });

          // Find numeric JSONs anywhere under extractionTarget
          const jsonPaths = await this.findAllFiles(extractionTarget, (name) => /^\d+\.json$/.test(name), 6);
          let movedJson = 0;
          for (const p of jsonPaths) {
            try {
              const base = p.split('/').pop() as string;
              const dest = `${canonicalJsonDir}/${base}`;
              if (p.startsWith(canonicalJsonDir)) continue; // already in place
              if (!(await RNFS.exists(dest))) {
                await RNFS.moveFile(p, dest);
                movedJson++;
              }
            } catch (moveErr) {
              // non-critical
            }
          }

          // Find image files anywhere and move them into canonical images dir
          const imagePaths = await this.findAllFiles(extractionTarget, (name) => /\.(png|jpe?g)$/i.test(name), 6);
          let movedImages = 0;
          for (const p of imagePaths) {
            try {
              const base = p.split('/').pop() as string;
              const dest = `${canonicalImagesDir}/${base}`;
              if (p.startsWith(canonicalImagesDir)) continue;
              if (!(await RNFS.exists(dest))) {
                await RNFS.moveFile(p, dest);
                movedImages++;
              }
            } catch (moveErr) {
              // non-critical
            }
          }

          // Additional normalization: some archives contain images named "9.png" instead of "page_9.png".
          // Rename numeric-only files to canonical page_N.png. Use move, fallback to copy+unlink if move fails.
          try {
            const images = await RNFS.readDir(canonicalImagesDir);
            let renamedImages = 0;
            for (const img of images) {
              try {
                if (!img.isFile) continue;
                const name = img.name;
                const m = name.match(/^(\d+)\.(png|jpg|jpeg)$/i);
                if (m) {
                  const num = m[1];
                  const canonicalName = `page_${num}.${m[2].toLowerCase()}`;
                  const src = img.path;
                  const dst = `${canonicalImagesDir}/${canonicalName}`;
                  if (await RNFS.exists(dst)) {
                    // target exists; skip
                    continue;
                  }
                  try {
                    await RNFS.moveFile(src, dst);
                    renamedImages++;
                  } catch (mvErr) {
                    // fallback: copy then unlink
                    try {
                      await RNFS.copyFile(src, dst);
                      await RNFS.unlink(src);
                      renamedImages++;
                    } catch (copyErr) {
                      // ignore non-critical
                    }
                  }
                }
              } catch (inner) {
                // ignore per-file errors
              }
            }
            if (renamedImages > 0) this.log('EXTRACT', `Renamed ${renamedImages} numeric images to page_N pattern`);
          } catch (e) {
            // ignore
          }

          if (movedJson > 0 || movedImages > 0) {
            this.log('EXTRACT', `Normalized extracted files: moved ${movedJson} JSON(s), ${movedImages} image(s)`);
          }
        } catch (e) {
          this.log('EXTRACT', 'Post-extraction normalization failed (non-critical)', e);
        }

        return; // Success
      } catch (err) {
        lastError = err;
        this.logError('EXTRACT', `Extraction failed (attempt ${attempt}):`, err);

        if (attempt < maxAttempts) {
          const backoffMs = 500 * attempt;
          this.log('EXTRACT', `Retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    // Final attempt to clean up
    try {
      const exists = await RNFS.exists(archivePath);
      if (exists) {
        await RNFS.unlink(archivePath);
        this.log('EXTRACT', `Final cleanup: Removed archive`);
      }
    } catch (e) {
      this.log('EXTRACT', 'Final cleanup failed (non-critical)', e);
    }

    throw new Error(
      `Failed to extract ${archiveName}: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    );
  }

  async download(onProgress?: (p: DownloadProgress) => void): Promise<void> {
    if (this.isDownloading) {
      throw new Error('Download already in progress');
    }

    this.isDownloading = true;
    this.cancelled = false;
    this.log('DOWNLOAD', '═══════════════════════════════════════');
    this.log('DOWNLOAD', 'Starting Mushaf download');

    try {
      await this.ensureCacheDir();

      const parts: {
        name: string;
        url: string;
        stage: DownloadProgress['stage'];
      }[] = [
        {
          name: 'mushaf-db.zip',
          url: MUSHAF_DOWNLOAD_URLS.db,
          stage: 'database'
        },
        {
          name: 'mushaf-layouts.zip',
          url: MUSHAF_DOWNLOAD_URLS.layouts,
          stage: 'layouts'
        },
        {
          name: 'mushaf-images.zip',
          url: MUSHAF_DOWNLOAD_URLS.images,
          stage: 'images'
        }
      ];

      let downloadedBytes = 0;
      const estimatedTotalMB = 3500;
      const estimatedTotalBytes = estimatedTotalMB * 1024 * 1024;

      for (const part of parts) {
        if (this.cancelled) {
          throw new Error('Download cancelled by user');
        }

        this.log('DOWNLOAD', `───────────────────────────────────────`);
        this.log('DOWNLOAD', `Starting: ${part.name}`);
        this.log('DOWNLOAD', `URL: ${part.url}`);

        const dest = `${MUSHAF_CACHE_DIR}/${part.name}`;

        try {
          // Download file
          const download = RNFS.downloadFile({
            fromUrl: part.url,
            toFile: dest,
            progressInterval: 500,
            progress: (p: any) => {
              const current = Number(p.bytesWritten || 0) + downloadedBytes;
              const percent = Math.min(
                100,
                Math.round((current / Math.max(1, estimatedTotalBytes)) * 100)
              );

              try {
                onProgress?.({
                  total: estimatedTotalBytes,
                  current,
                  percentage: percent,
                  stage: part.stage,
                  statusMessage: `Downloading ${part.stage}... ${percent}%`
                });
              } catch (e) {
                this.logError('DOWNLOAD', 'onProgress callback error', e);
              }
            }
          });

          this.currentJobId = (download as any).jobId ?? null;
          this.log('DOWNLOAD', `Job ID: ${this.currentJobId}`);

          const result = await (download as any).promise;
          this.log('DOWNLOAD', `Download completed, result:`, result);

          if (this.cancelled) {
            throw new Error('Download cancelled by user');
          }

          // Critical: Wait for file to be written to disk
          this.log('DOWNLOAD', `Waiting for file to be written...`);
          const fileExists = await this.waitForFile(dest, 10000);
          if (!fileExists) {
            throw new Error('File was downloaded but not written to disk');
          }

          this.log('DOWNLOAD', `✅ Downloaded ${part.name}`);

          // Now extract
          this.log('DOWNLOAD', `Extracting ${part.name}...`);
          await this.extractArchive(dest, MUSHAF_CACHE_DIR, part.name);

          downloadedBytes += Math.round(estimatedTotalBytes / parts.length);
        } catch (e) {
          this.logError('DOWNLOAD', `Failed to download/extract ${part.name}`, e);

          const errorMsg = e instanceof Error ? e.message : String(e);
          onProgress?.({
            total: estimatedTotalBytes,
            current: downloadedBytes,
            percentage: 0,
            stage: part.stage,
            statusMessage: `Error: ${errorMsg}`,
            error: errorMsg
          });

          throw e;
        }
      }

      // Verify installation
      this.log('DOWNLOAD', '───────────────────────────────────────');
      this.log('DOWNLOAD', 'Verifying installation...');
      const installed = await this.isInstalled();
      if (!installed) {
        throw new Error('Downloaded files not found in expected locations');
      }

      this.log('DOWNLOAD', '✅ Installation verified');
      this.log('DOWNLOAD', '═══════════════════════════════════════');

      onProgress?.({
        total: estimatedTotalBytes,
        current: estimatedTotalBytes,
        percentage: 100,
        stage: 'complete',
        statusMessage: 'Download complete! ✅'
      });
    } catch (e) {
      this.logError('DOWNLOAD', 'Download process failed', e);
      this.log('DOWNLOAD', '═══════════════════════════════════════');
      throw e;
    } finally {
      this.isDownloading = false;
      this.currentJobId = null;
      this.cancelled = false;
    }
  }
}

export const mushafDownloadService = new MushafDownloadService();

export async function checkMushafStatus(): Promise<'not-installed' | 'downloading' | 'ready' | 'error'> {
  try {
    const installed = await mushafDownloadService.isInstalled();
    return installed ? 'ready' : 'not-installed';
  } catch (e) {
    return 'error';
  }
}

export async function downloadMushaf(onProgress?: (progress: number) => void): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    try {
      await mushafDownloadService.download((p) => {
        try {
          if (onProgress) onProgress(p.percentage);
        } catch (e) {
          console.error('Progress callback error', e);
        }
      });
      resolve(true);
    } catch (e) {
      reject(e);
    }
  });
}

export async function deleteMushaf(): Promise<void> {
  return mushafDownloadService.delete();
}

export async function getMushafSize(): Promise<number> {
  return mushafDownloadService.getInstalledSize();
}

export async function getMushafCachePath(): Promise<string> {
  return MUSHAF_CACHE_DIR;
}