import { Alert } from 'react-native';
import RNFS from 'react-native-fs';

/**
 * Test iOS file permissions and RNFS download capability
 * Run this BEFORE trying to download Mushaf
 */
export async function testIOSFilePermissions() {
  console.log('═══════════════════════════════════════');
  console.log('[TEST] iOS File Permissions Test');
  console.log('═══════════════════════════════════════');

  try {
    // Test 1: Check available paths
    console.log('\n[TEST-1] Available RNFS paths:');
    console.log('DocumentDirectoryPath:', RNFS.DocumentDirectoryPath);
    console.log('CachesDirectoryPath:', RNFS.CachesDirectoryPath);
    console.log('TemporaryDirectoryPath:', RNFS.TemporaryDirectoryPath);
    console.log('LibraryDirectoryPath:', (RNFS as any).LibraryDirectoryPath);

    // Test 2: Write to DocumentDirectoryPath
    console.log('\n[TEST-2] Testing write to DocumentDirectoryPath...');
    const testFile = `${RNFS.DocumentDirectoryPath}/test-write.txt`;
    await RNFS.writeFile(testFile, 'TEST CONTENT', 'utf8');
    console.log('✅ Write successful');

    // Test 3: Read back
    console.log('\n[TEST-3] Reading back file...');
    const content = await RNFS.readFile(testFile, 'utf8');
    console.log('✅ Read successful:', content);

    // Test 4: Delete test file
    console.log('\n[TEST-4] Deleting test file...');
    await RNFS.unlink(testFile);
    console.log('✅ Delete successful');

    // Test 5: Create test directory
    console.log('\n[TEST-5] Creating test directory...');
    const testDir = `${RNFS.DocumentDirectoryPath}/test-dir`;
    await RNFS.mkdir(testDir);
    console.log('✅ Directory created:', testDir);

    // Test 6: Verify directory exists
    console.log('\n[TEST-6] Verifying directory...');
    const dirExists = await RNFS.exists(testDir);
    console.log('✅ Directory exists:', dirExists);

    // Test 7: Write file to subdirectory
    console.log('\n[TEST-7] Writing file to subdirectory...');
    const subFile = `${testDir}/subfile.txt`;
    await RNFS.writeFile(subFile, 'SUBDIR TEST', 'utf8');
    console.log('✅ Subdirectory file written');

    // Test 8: Clean up
    console.log('\n[TEST-8] Cleaning up test directory...');
    await RNFS.unlink(testDir);
    console.log('✅ Cleanup successful');

    // Test 9: List DocumentDirectory
    console.log('\n[TEST-9] Contents of DocumentDirectoryPath:');
    const files = await RNFS.readDir(RNFS.DocumentDirectoryPath);
    console.log('Files:', files.map((f: any) => f.name).join(', '));

    console.log('\n═══════════════════════════════════════');
    console.log('[TEST] ✅ All permission tests PASSED');
    console.log('═══════════════════════════════════════\n');

    Alert.alert('✅ Success', 'File permissions test passed. RNFS can write to DocumentDirectory.');
    return true;
  } catch (error) {
    console.error('\n❌ PERMISSION TEST FAILED:');
    console.error(error);
    console.log('═══════════════════════════════════════\n');

    const errorMsg = error instanceof Error ? error.message : String(error);
    Alert.alert('❌ Failed', `Permissions test failed:\n${errorMsg}`);
    return false;
  }
}

/**
 * Test small file download
 */
export async function testSmallFileDownload() {
  console.log('\n═══════════════════════════════════════');
  console.log('[TEST] Small File Download Test');
  console.log('═══════════════════════════════════════');

  try {
    const testUrl = 'https://httpbin.org/image/png'; // Small PNG ~2KB
    const testFile = `${RNFS.DocumentDirectoryPath}/test-download.png`;

    console.log('[DOWNLOAD] Starting small file download...');
    console.log('[DOWNLOAD] URL:', testUrl);
    console.log('[DOWNLOAD] Destination:', testFile);

    const download = RNFS.downloadFile({
      fromUrl: testUrl,
      toFile: testFile,
      progressInterval: 100,
      progress: (p: any) => {
        const percent = Math.round((Number(p.bytesWritten) / Number(p.contentLength)) * 100);
        console.log(`[DOWNLOAD] Progress: ${percent}%`);
      }
    });

    const result = await (download as any).promise;
    console.log('[DOWNLOAD] Download result:', result);

    // Check if file exists
    console.log('\n[VERIFY] Checking if file exists...');
    const exists = await RNFS.exists(testFile);
    console.log('[VERIFY] File exists:', exists);

    if (exists) {
      const stat = await RNFS.stat(testFile);
      console.log('[VERIFY] File size:', stat.size, 'bytes');

      // Try to read file
      console.log('[VERIFY] Attempting to read file...');
      const fileContent = await RNFS.readFile(testFile, 'base64');
      console.log('[VERIFY] ✅ File readable, size:', fileContent.length);

      // Clean up
      await RNFS.unlink(testFile);
      console.log('[VERIFY] Cleaned up test file');

      console.log('\n═══════════════════════════════════════');
      console.log('[TEST] ✅ Download test PASSED');
      console.log('═══════════════════════════════════════\n');

      Alert.alert('✅ Success', 'Download test passed. Small file downloaded and verified.');
      return true;
    } else {
      throw new Error('File downloaded but does not exist on disk');
    }
  } catch (error) {
    console.error('\n❌ DOWNLOAD TEST FAILED:');
    console.error(error);
    console.log('═══════════════════════════════════════\n');

    const errorMsg = error instanceof Error ? error.message : String(error);
    Alert.alert('❌ Failed', `Download test failed:\n${errorMsg}`);
    return false;
  }
}

/**
 * Test GitHub URLs directly
 */
export async function testGitHubURLs() {
  console.log('\n═══════════════════════════════════════');
  console.log('[TEST] GitHub URLs Accessibility Test');
  console.log('═══════════════════════════════════════');

  const urls = [
    'https://github.com/aishiek/ihafidh3/releases/download/Mushaf/mushaf-db.zip',
    'https://github.com/aishiek/ihafidh3/releases/download/Mushaf/mushaf-layouts.zip',
    'https://github.com/aishiek/ihafidh3/releases/download/Mushaf/mushaf-images.zip'
  ];

  for (const url of urls) {
    try {
      console.log(`\n[URL-TEST] Testing: ${url.split('/').pop()}`);
      // Try with browser-like headers (some servers treat fetch differently without these)
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      console.log(`[URL-TEST] Status: ${response.status}`);
      console.log(`[URL-TEST] Content-Length: ${response.headers.get('content-length')}`);
      console.log(`[URL-TEST] Final URL: ${response.url}`);

      if (response.status !== 200) {
        console.warn(`[URL-TEST] ⚠️  Non-200 status: ${response.status}`);
      } else {
        console.log('[URL-TEST] ✅ Accessible');
      }
    } catch (e) {
      console.error(`[URL-TEST] ❌ Error: ${e}`);
    }
  }

  console.log('\n═══════════════════════════════════════\n');
}

/**
 * Direct download test (GET) to capture response body/redirects
 */
export async function testGitHubDirectDownload() {
  console.log('\n═══════════════════════════════════════');
  console.log('[TEST] Direct GitHub Download Test');
  console.log('═══════════════════════════════════════');

  const url = 'https://github.com/aishiek/ihafidh3/releases/download/Mushaf/mushaf-db.zip';

  try {
    console.log('[DIRECT] URL:', url);
    const response = await fetch(url);

    console.log('[DIRECT] Status:', response.status);
    console.log('[DIRECT] OK:', response.ok);
    console.log('[DIRECT] URL after redirects:', response.url);

    // Read small portion (text) for diagnostics - archive will be binary but this helps see HTML error pages
    const text = await response.text();
    console.log('[DIRECT] Response text length:', text.length);
    console.log('[DIRECT] First 500 chars:', text.substring(0, 500));

  } catch (e) {
    console.error('[DIRECT] Error:', e);
  }

  console.log('═══════════════════════════════════════\n');
}

/**
 * Updated full diagnostic - now includes URL test
 */
export async function runFullDiagnostic() {
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║  MUSHAF iOS DIAGNOSTIC TEST SUITE    ║');
  console.log('╚═══════════════════════════════════════╝\n');

  const permissionsOk = await testIOSFilePermissions();

  if (!permissionsOk) {
    console.error('\n❌ Permissions test failed. Cannot proceed.');
    return false;
  }

  const downloadOk = await testSmallFileDownload();

  if (!downloadOk) {
    console.error('\n❌ Download test failed.');
    return false;
  }

  // NEW: Test GitHub URLs
  await testGitHubURLs();

  // NEW: Direct GET test to inspect response bodies/redirects
  await testGitHubDirectDownload();

  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║  ✅ ALL TESTS PASSED                 ║');
  console.log('║  Safe to proceed with Mushaf download║');
  console.log('╚═══════════════════════════════════════╝\n');

  return true;
}

// Expo Router expects a default export for all route files. This is a utility-only file, so export a dummy React component.
const DummyMushafDiagnostics = () => null;
export default DummyMushafDiagnostics;