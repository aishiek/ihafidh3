import { isMalayLanguage, isTamilLanguage } from '@/utils/language';
import { getMalayTafsir } from './localMalayTafsir';
import { getTamilTafsir } from './localTamilTafsir';
import { fetchTafsirByAyah } from './tafsirApi';

export type TafsirSource = 'local' | 'remote';

export interface TafsirFromSource {
  scholar: string;
  text: string;
  source: TafsirSource;
}

/**
 * Unified tafsir loader: prefer local Tamil tafsir when language indicates Tamil,
 * otherwise use remote fetch. Returns null when not available.
 */
export async function getTafsirFromSource(surah: number, verse: number, userLanguage?: string): Promise<TafsirFromSource | null> {
  try {
    if (isTamilLanguage(userLanguage)) {
      const local = await getTamilTafsir(surah, verse);
      if (local && local.text) {
        return { scholar: local.resourceName || 'Tamil Tafsir', text: local.text, source: 'local' };
      }
      // fallthrough to remote if local not found
    }
    if (isMalayLanguage(userLanguage)) {
      const local = await getMalayTafsir(surah, verse);
      if (local && local.text) {
        return { scholar: local.resourceName || 'Malay Tafsir', text: local.text, source: 'local' };
      }
      // fallthrough to remote if local not found
    }
    const remote = await fetchTafsirByAyah(surah, verse, userLanguage);
    if (remote && remote.text) {
      return { scholar: remote.resourceName || 'Tafsir', text: remote.text, source: 'remote' };
    }
    return null;
  } catch (e) {
    console.warn('[tafsirService] getTafsirFromSource failed', e);
    return null;
  }
}
