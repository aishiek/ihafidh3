import RNFS from 'react-native-fs';

export async function ensureMushafDirs() {
  const baseDir = `${RNFS.DocumentDirectoryPath}/mushaf`;
  const jsonDir = `${baseDir}/json`;
  const imagesDir = `${baseDir}/images`;
  try {
    await RNFS.mkdir(jsonDir);
  } catch {}
  try {
    await RNFS.mkdir(imagesDir);
  } catch {}
}
