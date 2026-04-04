import { useEffect, useState } from 'react';
import { getWBWForVerse, WBWWord } from '@/services/wbwDbService';
import { BISMILLAH_WBW } from '@/constants/basmalah';

export interface WBWData {
  word_index: number;
  translation: string;
}

export function useWordByWord({
  surahId,
  ayah,
  translationLanguage,
  enabled,
}: {
  surahId: number;
  ayah: number;
  translationLanguage: string;
  enabled: boolean;
}) {
  const [wbwData, setWbwData] = useState<WBWData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      if (!enabled) {
        setWbwData([]);
        return;
      }

      setIsLoading(true);
      try {
        let rawData: WBWWord[] = [];

        // Catch Basmalah (Verse 0) before hitting DB
        if (ayah === 0) {
          rawData = BISMILLAH_WBW;
        } else {
          rawData = await getWBWForVerse(surahId, ayah);
        }
        
        if (isMounted) {
          // Map to the requested language
          const langCode = (translationLanguage.split('.')[0] || 'en').toLowerCase();
          
          const mappedData: WBWData[] = rawData.map(word => {
            let translation = '';
            switch (langCode) {
              case 'ta': translation = word.ta; break;
              case 'id': translation = word.id; break;
              case 'ms': translation = word.ms || word.id; break; // ms fallback to id
              case 'en': 
              default:
                translation = word.en;
                break;
            }
            return {
              word_index: word.word_index,
              translation: translation || word.en, // Final fallback to English if translation is empty
            };
          });
          
          setWbwData(mappedData);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[useWordByWord] Hook error:', error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [surahId, ayah, translationLanguage, enabled]);

  return {
    wbwData,
    isLoading,
  };
}
