import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// Use expo-file-system consistently for better cross-platform compatibility
// This ensures paths work correctly with both expo-file-system and expo-sqlite operations
export const MUSHAF_CACHE_DIR = Platform.select({
  ios: `${FileSystem.documentDirectory}mushaf`,
  android: `${FileSystem.documentDirectory}mushaf`,
  default: `${FileSystem.documentDirectory}mushaf`
}) as string;

// Expo Router expects a default export for all route files. This is a constants-only file, so export a dummy React component.
const DummyMushafConstants = () => null;
export default DummyMushafConstants;
