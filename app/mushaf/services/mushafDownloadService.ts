import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';
import { MUSHAF_CACHE_DIR } from '../utils/mushafConstants';
// NOTE: Layout installation status should be determined dynamically; ignore static `downloaded` field in AVAILABLE_LAYOUTS.

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
  images_indopak: `${GITHUB_RELEASE_BASE}/mushaf-images.zip`,
  images_madina: `${GITHUB_RELEASE_BASE}/mushaf-images-madina.zip`,
  images_warsh: `${GITHUB_RELEASE_BASE}/mushaf-images-warsh.zip`,
  images_tajweed: `${GITHUB_RELEASE_BASE}/mushaf-images-tajweed.zip`,
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
      
      // Check if at least one layout is installed (new layout-specific system)
      const layoutIds = ['indopak_15', 'madina_15', 'warsh_15', 'tajweed'];
      for (const layoutId of layoutIds) {
        const layoutInstalled = await this.isLayoutInstalled(layoutId);
        if (layoutInstalled) {
          this.log('CHECK', `✅ Mushaf installed: Layout ${layoutId} is ready`);
          return true;
        }
      }
      
      // Fallback: Check legacy installation (for backwards compatibility)
      const dbExists = await RNFS.exists(`${MUSHAF_CACHE_DIR}/qudratullah-indopak-15-lines.db`);
      
      // Check page coordinate JSON files
      let pageJsonCount = 0;
      const jsonDir = `${MUSHAF_CACHE_DIR}/json`;
      if (await RNFS.exists(jsonDir)) {
        try {
          const jsonContents = await RNFS.readDir(jsonDir);
          const pageJsonFiles = jsonContents.filter((f: any) => f.isFile && /^\d+\.json$/.test(f.name));
          pageJsonCount = pageJsonFiles.length;
        } catch (e) {
          this.logError('CHECK', 'Failed to read json directory', e);
        }
      }

      // Check images count across known locations (legacy)
      let imageCount = 0;
      const imagesDir = `${MUSHAF_CACHE_DIR}/images`;
      try {
        if (await RNFS.exists(imagesDir)) {
          const files = await RNFS.readDir(imagesDir);
          const rootImages = files.filter((f: any) => f.isFile && (f.name.endsWith('.png') || f.name.endsWith('.jpg') || f.name.endsWith('.jpeg')));
          imageCount += rootImages.length;
        }
      } catch (e) {
        this.logError('CHECK', 'Failed to aggregate images count', e);
      }

      // Relaxed legacy check: require DB + JSON + at least 500 images
      const legacyComplete = dbExists && pageJsonCount >= 500 && imageCount >= 500;
      
      if (legacyComplete) {
        this.log('CHECK', `✅ Mushaf installed (legacy): DB ✓, ${pageJsonCount} pages ✓, ${imageCount} images ✓`);
        return true;
      } else {
        this.log('CHECK', `❌ No layouts installed. DB: ${dbExists}, Pages: ${pageJsonCount}, Images: ${imageCount}`);
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
        const fileReady = await this.waitForFile(archivePath, 10000);
        if (!fileReady) {
          throw new Error('Archive file never appeared on disk');
        }

        // Verify file size
        const stat = await RNFS.stat(archivePath);
        const size = Number(stat.size || 0);
        
        if (size < 1024) {
          throw new Error(`File too small to extract: ${size} bytes`);
        }

        this.log('EXTRACT', `Extracting ${Math.round(size / (1024 * 1024))}MB...`);

        // Extract with timeout
        const extractPromise = unzip(archivePath, extractionTarget);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Extraction timeout')), 120000)
        );
        
        await Promise.race([extractPromise, timeoutPromise]);

        // Verify extraction
        try {
          const files = await RNFS.readDir(extractionTarget);
               this.log('EXTRACT', `Extracted files: ${files.map((f: any) => f.name).join(', ')}`);
        } catch (e) {
          this.log('EXTRACT', 'Could not list files (non-critical)', e);
        }

        // Verify extraction with timeout
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const extractedFiles = await RNFS.readDir(extractionTarget);
        this.log('EXTRACT', `✅ Extracted ${extractedFiles.length} items`);

        // Safe cleanup - try to remove archive
        try {
          await RNFS.unlink(archivePath);
          this.log('EXTRACT', `✅ Removed archive: ${archiveName}`);
        } catch (e) {
          this.log('EXTRACT', `⚠️  Could not remove archive (will retry next time)`, e);
        }

        // FIX: Removed aggressive post-extraction normalization
        // The old code moved ALL files to shared canonical directories causing layout collisions.
        // Layout-specific normalization now happens in normalizeImagesDirectory() after download completes.

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

  /**
   * Download a specific layout (images + database)
   * @param layoutId - 'indopak_15', 'madina_15', 'warsh_15', or 'tajweed'
   */
  async downloadLayout(layoutId: string, onProgress?: (p: DownloadProgress) => void): Promise<void> {
    if (this.isDownloading) {
      throw new Error('Download already in progress');
    }

    this.isDownloading = true;
    this.cancelled = false;
    this.log('DOWNLOAD', '═══════════════════════════════════════');
    this.log('DOWNLOAD', `Starting ${layoutId} layout download`);

    try {
      await this.ensureCacheDir();

      // Map layout ID to download URL and slug
      const layoutImageUrls: Record<string, string> = {
        'indopak_15': MUSHAF_DOWNLOAD_URLS.images_indopak,
        'madina_15': MUSHAF_DOWNLOAD_URLS.images_madina,
        'warsh_15': MUSHAF_DOWNLOAD_URLS.images_warsh,
        'tajweed': MUSHAF_DOWNLOAD_URLS.images_tajweed,
      };
      const layoutSlugMap: Record<string, string> = {
        'indopak_15': 'indopak',
        'madina_15': 'madina',
        'warsh_15': 'warsh',
        'tajweed': 'tajweed',
      };
      const imageUrl = layoutImageUrls[layoutId];
      const slug = layoutSlugMap[layoutId];
      if (!imageUrl) {
        throw new Error(`Unknown layout: ${layoutId}`);
      }

      // Build download parts with light heuristics to avoid redundant downloads
      const parts: { name: string; url: string; stage: DownloadProgress['stage']; skip?: boolean }[] = [];

      // DB stage: only needed for legacy IndoPak cache; other layouts use packaged DB
      const legacyDbPath = `${MUSHAF_CACHE_DIR}/qudratullah-indopak-15-lines.db`;
      parts.push({
        name: 'mushaf-db.zip',
        url: MUSHAF_DOWNLOAD_URLS.db,
        stage: 'database',
        skip: layoutId !== 'indopak_15' && (await RNFS.exists(legacyDbPath)),
      });

      // Layouts JSON stage: skip if directory already exists
      const mushafLayoutsDir = `${MUSHAF_CACHE_DIR}/mushaf-layouts`;
      parts.push({
        name: 'mushaf-layouts.zip',
        url: MUSHAF_DOWNLOAD_URLS.layouts,
        stage: 'layouts',
        skip: await RNFS.exists(mushafLayoutsDir),
      });

      // Images stage: always download for the requested layout
      parts.push({
        name: `mushaf-images-${slug}.zip`,
        url: imageUrl,
        stage: 'images',
      });

      // Stage-weighted progress to avoid 0% UI and reflect real progress
      const weightByStage: Record<DownloadProgress['stage'], number> = {
        database: 0.1,
        layouts: 0.1,
        images: 0.8,
        extracting: 0.0,
        complete: 0.0,
      };
      let offset = 0; // accumulated completed fraction [0..1]

      for (const part of parts) {
        if (this.cancelled) {
          throw new Error('Download cancelled by user');
        }

        this.log('DOWNLOAD', `───────────────────────────────────────`);
        if (part.skip) {
          this.log('DOWNLOAD', `Skipping ${part.name} (already present)`);
          // Advance offset by this stage's weight so overall progress reflects the skip
          const w = weightByStage[part.stage] ?? 0;
          offset = Math.min(0.99, offset + w);
          try {
            const percent = Math.max(1, Math.min(99, Math.round(offset * 100)));
            onProgress?.({ total: 0, current: 0, percentage: percent, stage: part.stage, statusMessage: `Skipping ${part.stage}... ${percent}%` });
          } catch (_) {}
          continue;
        }

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
              const totalBytes = Number(p.contentLength || p.totalBytesExpectedToWrite || 0);
              const writtenBytes = Number(p.bytesWritten || p.totalBytesWritten || 0);
              const frac = totalBytes > 0 ? Math.max(0, Math.min(1, writtenBytes / totalBytes)) : 0.02; // small nudge if size unknown
              const w = weightByStage[part.stage] ?? 0.33;
              const overall = offset + frac * w;
              const percent = Math.max(1, Math.min(99, Math.round(overall * 100)));

              try {
                onProgress?.({
                  total: totalBytes,
                  current: writtenBytes,
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

          // After extracting images, normalize folder structure to expected location
          if (part.stage === 'images') {
            await this.normalizeImagesDirectory(layoutId);
            // Count images immediately after normalization (extension-based)
            try {
              const verifyNow = await this.verifyLayoutImages(layoutId);
              if (!verifyNow.ok) {
                this.log('DOWNLOAD', `Image count after extract incomplete: ${verifyNow.count}/${verifyNow.expected}`);
              }
            } catch (e) {
              this.logError('DOWNLOAD', 'Immediate image count failed', e);
            }
          }

          // Advance offset to end of this stage
          const w = weightByStage[part.stage] ?? 0.33;
          offset = Math.min(0.99, offset + w);
          try {
            const percent = Math.max(1, Math.min(99, Math.round(offset * 100)));
            onProgress?.({ total: 0, current: 0, percentage: percent, stage: 'extracting', statusMessage: `Finalizing ${part.stage}... ${percent}%` });
          } catch (_) {}
        } catch (e) {
          this.logError('DOWNLOAD', `Failed to download/extract ${part.name}`, e);

          const errorMsg = e instanceof Error ? e.message : String(e);
          onProgress?.({
            total: 0,
            current: 0,
            percentage: 0,
            stage: part.stage,
            statusMessage: `Error: ${errorMsg}`,
            error: errorMsg
          });

          throw e;
        }
      }

      // Verify installation for the specific layout just downloaded
      this.log('DOWNLOAD', '───────────────────────────────────────');
      this.log('DOWNLOAD', `Verifying installation for ${layoutId}...`);
      const installed = await this.isLayoutInstalled(layoutId);
      const counts = await this.verifyLayoutImages(layoutId);
      if (!installed) {
        throw new Error('Downloaded files not found in expected locations');
      }
      if (!counts.ok) {
        this.log('DOWNLOAD', `⚠️  Layout present but images incomplete (${counts.count}/${counts.expected}). Leaving at 99%.`);
        onProgress?.({ total: 1, current: 0, percentage: 99, stage: 'complete', statusMessage: `Images incomplete (${counts.count}/${counts.expected}).` });
      } else {
        this.log('DOWNLOAD', `✅ Installation verified with complete images (${counts.count}/${counts.expected}).`);
        onProgress?.({ total: 1, current: 1, percentage: 100, stage: 'complete', statusMessage: 'Download complete! ✅' });
      }
      this.log('DOWNLOAD', '═══════════════════════════════════════');
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

  /**
   * Ensure images for a given layout are placed under `${MUSHAF_CACHE_DIR}/images/<dirName>`.
   * Also standardizes all filenames to `page_N.<ext>` format with correct extension per layout.
   * ONLY processes layout-specific directories - never touches the legacy shared images directory.
   */
  private async normalizeImagesDirectory(layoutId: string): Promise<void> {
    const layoutDirs: Record<string, string> = {
      'indopak_15': 'indopak',
      'madina_15': 'madina',
      'warsh_15': 'warsh',
      'tajweed': 'tajweed',
    };
    const dirName = layoutDirs[layoutId];
    if (!dirName) return;

    const targetDir = `${MUSHAF_CACHE_DIR}/images/${dirName}`;
    const topLevelDir = `${MUSHAF_CACHE_DIR}/${dirName}`;
    
    // Possible source locations after extraction
    const possibleSources = [
      topLevelDir,                                    // e.g., mushaf/indopak/
      `${MUSHAF_CACHE_DIR}/mushaf-images/${dirName}`, // e.g., mushaf/mushaf-images/indopak/
      `${MUSHAF_CACHE_DIR}/mushaf-images`             // e.g., mushaf/mushaf-images/ (flat)
    ];

    try {
      // Ensure target directory exists
      if (!(await RNFS.exists(targetDir))) {
        await RNFS.mkdir(targetDir, { mkdirs: true });
      }

      let totalMoved = 0;
      
      // Try each possible source location
      for (const sourceDir of possibleSources) {
        if (!(await RNFS.exists(sourceDir))) continue;
        
        const files = await RNFS.readDir(sourceDir);
        let movedCount = 0;
        
        for (const f of files) {
          if (f.isFile && /\.(png|jpe?g)$/i.test(f.name)) {
            const standardized = this.standardizeFilename(f.name, layoutId);
            const dest = `${targetDir}/${standardized}`;
            
            try {
              if (!(await RNFS.exists(dest))) {
                await RNFS.moveFile(f.path, dest);
                movedCount++;
              }
            } catch (moveErr) {
              // Log but continue
              this.log('NORMALIZE', `Failed to move ${f.name}:`, moveErr);
            }
          }
        }
        
        if (movedCount > 0) {
          totalMoved += movedCount;
          this.log('NORMALIZE', `Moved ${movedCount} images from ${sourceDir.split('/').pop()}/ for ${layoutId}`);
          
          // Only remove source dir if it's now empty and not the images dir itself
          if (sourceDir !== `${MUSHAF_CACHE_DIR}/images`) {
            try {
              const remaining = await RNFS.readDir(sourceDir);
              if (remaining.length === 0) {
                await RNFS.unlink(sourceDir);
              }
            } catch (e) {
              // Non-critical
            }
          }
        }
      }

      // Standardize filenames in target directory (images may already be there from extraction)
      if (await RNFS.exists(targetDir)) {
        const targetFiles = await RNFS.readDir(targetDir);
        let renamedCount = 0;
        for (const f of targetFiles) {
          if (f.isFile && /\.(png|jpe?g)$/i.test(f.name)) {
            const standardized = this.standardizeFilename(f.name, layoutId);
            if (standardized !== f.name) {
              const newPath = `${targetDir}/${standardized}`;
              try {
                if (!(await RNFS.exists(newPath))) {
                  await RNFS.moveFile(f.path, newPath);
                  renamedCount++;
                }
              } catch (e) {
                // Non-critical
              }
            }
          }
        }
        
        if (renamedCount > 0) {
          this.log('NORMALIZE', `Standardized ${renamedCount} filenames for ${layoutId}`);
        }
        
        // Log final count after normalization
        const finalFiles = await RNFS.readDir(targetDir);
        const imageCount = finalFiles.filter((f: any) => f.isFile && /\.(png|jpe?g)$/i.test(f.name)).length;
        this.log('NORMALIZE', `Final image count in ${targetDir}: ${imageCount}`);
      }
    } catch (e) {
      this.logError('NORMALIZE', `Failed to normalize images for ${layoutId}`, e);
    }
  }

  /**
   * Standardize filename to page_N.<ext> format with correct extension for layout
   */
  private standardizeFilename(filename: string, layoutId: string): string {
    // Determine correct extension for layout
    const correctExt = layoutId === 'indopak_15' ? '.png' : '.jpg';
    
    // Extract page number from various formats
    const patterns = [
      /^page[-_]?(\d+)\.(png|jpe?g)$/i,
      /^(\d+)\.(png|jpe?g)$/i,
    ];
    
    for (const pattern of patterns) {
      const match = filename.match(pattern);
      if (match) {
        const pageNum = parseInt(match[1], 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= 610) {
          return `page_${pageNum}${correctExt}`;
        }
      }
    }
    
    // If no match, return original
    return filename;
  }

  /**
   * Verify image counts for a layout. All layouts should have 610 pages.
   * ONLY checks the layout-specific directory - no legacy fallback.
   */
  private async verifyLayoutImages(layoutId: string): Promise<{ 
    layoutId: string; 
    count: number; 
    expected: number; 
    ok: boolean; 
    dir: string 
  }> {
    const layoutDirs: Record<string, string> = {
      'indopak_15': 'indopak',
      'madina_15': 'madina',
      'warsh_15': 'warsh',
      'tajweed': 'tajweed',
    };
    
    const dirName = layoutDirs[layoutId];
    if (!dirName) return { layoutId, count: 0, expected: 0, ok: false, dir: '' };
    
    const expected = 610; // All layouts should have 610 pages
    const correctExt = layoutId === 'indopak_15' ? '.png' : '.jpg';
    
    // Check ONLY the layout-specific directory
    const targetDir = `${MUSHAF_CACHE_DIR}/images/${dirName}`;
    
    try {
      if (!(await RNFS.exists(targetDir))) {
        this.log('VERIFY', `Directory not found: ${targetDir}`);
        return { layoutId, count: 0, expected, ok: false, dir: targetDir };
      }
      
      const files = await RNFS.readDir(targetDir);
      const imageFiles = files.filter((f: any) => 
        f.isFile && 
        f.name.endsWith(correctExt) && 
        /^page_\d+\.(png|jpe?g)$/i.test(f.name)
      );
      
      const count = imageFiles.length;
      const ok = count >= expected;
      
      this.log('VERIFY', `${ok ? '✅' : '❌'} ${layoutId}: ${count}/${expected} images in ${targetDir}`);
      
      return { layoutId, count, expected, ok, dir: targetDir };
    } catch (e) {
      this.logError('VERIFY', `Failed to verify ${layoutId}`, e);
      return { layoutId, count: 0, expected, ok: false, dir: targetDir };
    }
  }

  /**
   * Check if a specific layout is installed
   */
  async isLayoutInstalled(layoutId: string): Promise<boolean> {
    try {
      const layoutDirs: Record<string, string> = {
        'indopak_15': 'indopak',
        'madina_15': 'madina',
        'warsh_15': 'warsh',
        'tajweed': 'tajweed',
      };

      const dirName = layoutDirs[layoutId];
      if (!dirName) return false;

      // Check layout-specific directory first
      const imagesDir = `${MUSHAF_CACHE_DIR}/images/${dirName}`;
      const dirExists = await RNFS.exists(imagesDir);
      
      if (dirExists) {
        // Check if images directory has files
        const files = await RNFS.readDir(imagesDir);
        const imageFiles = files.filter((f: any) => 
          f.isFile && (f.name.endsWith('.png') || f.name.endsWith('.jpg') || f.name.endsWith('.jpeg'))
        );

        // Require at least 500 images (most layouts have 604-610 pages)
        const hasImages = imageFiles.length >= 500;
        
        if (hasImages) {
          this.log('CHECK', `✅ Layout ${layoutId} installed: ${imageFiles.length} images`);
          return true;
        }
      }

      // Fallback: Some archives place images under top-level `${MUSHAF_CACHE_DIR}/<dirName>`
      const topLevelDir = `${MUSHAF_CACHE_DIR}/${dirName}`;
      if (await RNFS.exists(topLevelDir)) {
        const files = await RNFS.readDir(topLevelDir);
        const imageFiles = files.filter((f: any) => 
          f.isFile && (f.name.endsWith('.png') || f.name.endsWith('.jpg') || f.name.endsWith('.jpeg'))
        );
        if (imageFiles.length >= 500) {
          this.log('CHECK', `✅ Layout ${layoutId} installed (top-level dir): ${imageFiles.length} images`);
          return true;
        }
      }

      // Fallback: Check legacy location for IndoPak (backwards compatibility)
      if (layoutId === 'indopak_15') {
        const legacyDir = `${MUSHAF_CACHE_DIR}/images`;
        const legacyExists = await RNFS.exists(legacyDir);
        
        if (legacyExists) {
          const files = await RNFS.readDir(legacyDir);
          const imageFiles = files.filter((f: any) => 
            f.isFile && f.name.endsWith('.png')
          );
          
          if (imageFiles.length >= 500) {
            this.log('CHECK', `✅ IndoPak installed (legacy location): ${imageFiles.length} images`);
            return true;
          }
        }
      }

      this.log('CHECK', `❌ Layout ${layoutId} not installed`);
      return false;
    } catch (e) {
      this.logError('CHECK', `isLayoutInstalled(${layoutId}) failed`, e);
      return false;
    }
  }

  /**
   * Get installed size for a specific layout
   */
  async getLayoutSize(layoutId: string): Promise<number> {
    try {
      const layoutDirs: Record<string, string> = {
        'indopak_15': 'indopak',
        'madina_15': 'madina',
        'warsh_15': 'warsh',
        'tajweed': 'tajweed',
      };

      const dirName = layoutDirs[layoutId];
      if (!dirName) return 0;

      // Check layout-specific directory first
      const imagesDir = `${MUSHAF_CACHE_DIR}/images/${dirName}`;
      if (await RNFS.exists(imagesDir)) {
        let total = 0;
        const files = await RNFS.readDir(imagesDir);
        for (const f of files) {
          if (f.isFile) {
            const s = await RNFS.stat(f.path);
            total += Number(s.size || 0);
          }
        }
        return Math.round(total / (1024 * 1024)); // Return in MB
      }

      // Fallback: Top-level `${MUSHAF_CACHE_DIR}/<dirName>`
      const topLevelDir = `${MUSHAF_CACHE_DIR}/${dirName}`;
      if (await RNFS.exists(topLevelDir)) {
        let total = 0;
        const files = await RNFS.readDir(topLevelDir);
        for (const f of files) {
          if (f.isFile && (f.name.endsWith('.png') || f.name.endsWith('.jpg') || f.name.endsWith('.jpeg'))) {
            const s = await RNFS.stat(f.path);
            total += Number(s.size || 0);
          }
        }
        return Math.round(total / (1024 * 1024));
      }

      // Fallback: Check legacy location for IndoPak
      if (layoutId === 'indopak_15') {
        const legacyDir = `${MUSHAF_CACHE_DIR}/images`;
        if (await RNFS.exists(legacyDir)) {
          let total = 0;
          const files = await RNFS.readDir(legacyDir);
          for (const f of files) {
            if (f.isFile && f.name.endsWith('.png')) {
              const s = await RNFS.stat(f.path);
              total += Number(s.size || 0);
            }
          }
          return Math.round(total / (1024 * 1024)); // Return in MB
        }
      }

      return 0;
    } catch (e) {
      this.logError('SIZE', `getLayoutSize(${layoutId}) failed`, e);
      return 0;
    }
  }

  /**
   * Delete a specific layout
   */
  async deleteLayout(layoutId: string): Promise<void> {
    try {
      const layoutDirs: Record<string, string> = {
        'indopak_15': 'indopak',
        'madina_15': 'madina',
        'warsh_15': 'warsh',
        'tajweed': 'tajweed',
      };

      const dirName = layoutDirs[layoutId];
      if (!dirName) return;

      const imagesDir = `${MUSHAF_CACHE_DIR}/images/${dirName}`;
      const jsonDir = `${MUSHAF_CACHE_DIR}/json/${dirName}`;

      if (await RNFS.exists(imagesDir)) {
        await RNFS.unlink(imagesDir);
        this.log('DELETE', `✅ Deleted ${layoutId} images`);
      }

      if (await RNFS.exists(jsonDir)) {
        await RNFS.unlink(jsonDir);
        this.log('DELETE', `✅ Deleted ${layoutId} JSON data`);
      }
    } catch (e) {
      this.logError('DELETE', `Failed to delete layout ${layoutId}`, e);
      throw e;
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

export async function downloadMushaf(layoutId: string = 'indopak_15', onProgress?: (progress: number) => void): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    try {
      await mushafDownloadService.downloadLayout(layoutId, (p: DownloadProgress) => {
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

export async function checkLayoutStatus(layoutId: string): Promise<'not-installed' | 'ready' | 'error'> {
  try {
    const installed = await mushafDownloadService.isLayoutInstalled(layoutId);
    return installed ? 'ready' : 'not-installed';
  } catch (e) {
    return 'error';
  }
}

export async function deleteLayout(layoutId: string): Promise<void> {
  return mushafDownloadService.deleteLayout(layoutId);
}

export async function getLayoutSize(layoutId: string): Promise<number> {
  return mushafDownloadService.getLayoutSize(layoutId);
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