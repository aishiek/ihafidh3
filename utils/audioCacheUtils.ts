let sound: any = null;

export function clearAudioCache(): void {
  if (sound) {
    sound.unloadAsync().catch(console.error);
    sound = null;
  }
}
