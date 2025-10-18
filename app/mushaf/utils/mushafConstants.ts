import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

export const MUSHAF_CACHE_DIR = Platform.select({
  ios: `${RNFS.DocumentDirectoryPath}/mushaf`,
  android: `${RNFS.ExternalDirectoryPath || RNFS.DocumentDirectoryPath}/mushaf`,
  default: `${RNFS.DocumentDirectoryPath}/mushaf`
}) as string;
