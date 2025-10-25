import { Platform } from 'react-native';

/**
 * Normalize a local filesystem path or URI for usage with React Native <Image />.
 * - If already starts with file://, returned as-is.
 * - If starts with / (absolute path), returns file:// + path.
 * - If on Android and the URI is content://, returns as-is but logs a warning
 *   because React Native's Image may not be able to load content:// URIs
 *   without copying them into app-controlled storage.
 */
export function ensureFileUri(pathOrUri?: string | null): string | null {
  if (!pathOrUri) return null;

  // Already a file:// URI
  if (pathOrUri.startsWith('file://')) return pathOrUri;

  // Android content URIs cannot be naively prefixed; warn the caller
  if (Platform.OS === 'android' && pathOrUri.startsWith('content://')) {
    console.warn('[ensureFileUri] Received content:// URI on Android. Consider copying the asset into app storage and using file:// path.');
    return pathOrUri;
  }

  // Absolute filesystem path (e.g. /data/user/0/...)
  if (pathOrUri.startsWith('/')) return `file://${pathOrUri}`;

  // Fallback: return as-is
  return pathOrUri;
}

export default ensureFileUri;
