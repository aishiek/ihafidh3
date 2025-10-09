import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'app_install_date';

export async function getOrSetInstallDate(): Promise<string> {
  // Returns YYYY-MM-DD
  try {
    const existing = await AsyncStorage.getItem(KEY);
    if (existing) return existing;
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    const iso = `${yyyy}-${mm}-${dd}`;
    await AsyncStorage.setItem(KEY, iso);
    return iso;
  } catch {
    // Fallback to today without persisting if storage fails
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
