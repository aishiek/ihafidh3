import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

export const MUSHAF_CACHE_DIR = Platform.select({
  ios: `${RNFS.DocumentDirectoryPath}/mushaf`,
  android: `${RNFS.ExternalDirectoryPath || RNFS.DocumentDirectoryPath}/mushaf`,
  default: `${RNFS.DocumentDirectoryPath}/mushaf`
}) as string;

// Expo Router expects a default export for all route files. This is a constants-only file, so export a dummy React component.
const DummyMushafConstants = () => null;
export default DummyMushafConstants;
