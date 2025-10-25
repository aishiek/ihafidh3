import { useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import RNFS from 'react-native-fs';
import Svg, { Rect, Image as SvgImage, Text as SvgText } from 'react-native-svg';
import { TAJWEED_COLORS, TajweedRule } from '../../../types/tajweed';
import { useTajweed } from '../../hooks/useTajweed';
import { TajweedService } from '../services/tajweedService';
import { ensureFileUri } from '../utils/fileUtils';
import { MUSHAF_CACHE_DIR } from '../utils/mushafConstants';

interface MushafPageProps {
  pageNumber?: number;
}

interface WordBox {
  verseKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
}

const IMAGES_DIR = `${MUSHAF_CACHE_DIR}/images`;
const JSON_DIR = `${MUSHAF_CACHE_DIR}/json`;

// Quran page dimensions (standard)
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 866;

export function MushafPage(props: MushafPageProps) {
  const route = useRoute();
  
  // Get page number from multiple sources (priority order)
  const getPageNumber = (): number => {
    // 1. From props
    if (props.pageNumber !== undefined && props.pageNumber > 0) {
      return props.pageNumber;
    }
    
    // 2. From route params
    if ((route as any)?.params?.pageNumber !== undefined) {
      return (route as any).params.pageNumber;
    }
    
    // 3. Default to page 1
    console.warn('[MushafPage] pageNumber not provided, defaulting to page 1');
    return 1;
  };

  const [pageNumber, setPageNumber] = useState(getPageNumber());
  const { config: tajweedConfig, initialized: tajweedInitialized } = useTajweed();
  const [state, setState] = useState<{
    imageUri: string | null;
    wordBoxes: WordBox[];
    loading: boolean;
    error: string | null;
  }>({
    imageUri: null,
    wordBoxes: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    const currentPage = getPageNumber();
    console.log(`[MushafPage] Loading page ${currentPage}`);
    setPageNumber(currentPage);
    loadPageData(currentPage);
  }, [props.pageNumber, (route as any)?.params?.pageNumber]);

  const loadPageData = async (pageNum: number) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      console.log(`[MushafPage] Starting load for page ${pageNum}`);

      // Load image
      const imageUri = await getPageImageUri(pageNum);
      console.log(`[MushafPage] Image URI: ${imageUri ? 'Found' : 'Not found'}`);
      
      if (!imageUri) {
        throw new Error(`Page image not found for page ${pageNum}`);
      }

      // Load word coordinates
      const wordBoxes = await loadWordCoordinates(pageNum);
      // Try to augment with tajweed info (grouped by surah:ayah)
      const tajweedMap = new Map<string, any>();
      try {
        await TajweedService.initialize();
        // collect unique surah:ayah pairs
        const ayahKeys = Array.from(new Set(wordBoxes.map(w => {
          const parts = w.verseKey.split(':');
          return `${parts[0]}:${parts[1]}`;
        })));

        for (const key of ayahKeys) {
          const [sStr, aStr] = key.split(':');
          const s = Number(sStr);
          const a = Number(aStr);
          if (Number.isFinite(s) && Number.isFinite(a)) {
            const words = await TajweedService.getWordsForAyah(s, a);
            // map position_in_ayah -> WordWithTajweed
            const posMap = new Map<number, any>();
            for (const w of words) posMap.set(w.position_in_ayah, w);
            tajweedMap.set(key, posMap);
          }
        }
      } catch (e) {
        console.warn('[MushafPage] Tajweed initialization failed or no tajweed DB available', e);
      }
      console.log(`[MushafPage] Loaded ${wordBoxes.length} word boxes`);

      setState({
        imageUri,
        wordBoxes: wordBoxes.map((wb) => ({ ...wb, _tajweedKeyMap: tajweedMap })),
        loading: false,
        error: null,
      });

      console.log(
        `[MushafPage] ✅ Loaded page ${pageNum}: image + ${wordBoxes.length} words`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[MushafPage] ❌ Error:`, message);
      setState(prev => ({
        ...prev,
        loading: false,
        error: message,
      }));
    }
  };

  if (state.loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFA500" />
        <Text style={styles.loadingText}>Loading page {pageNumber}...</Text>
      </View>
    );
  }

  if (state.error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Error: {state.error}</Text>
        <Text style={styles.debugText}>Page: {pageNumber}</Text>
        <Text style={styles.debugText}>Props: {JSON.stringify(props)}</Text>
      </View>
    );
  }

  if (!state.imageUri) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>No image found</Text>
      </View>
    );
  }

  // Calculate dimensions to fit the screen while maintaining aspect ratio
  const windowWidth = Dimensions.get('window').width;
  const windowHeight = Dimensions.get('window').height - 180; // Account for header and footer
  
  // Calculate scale to fit width while maintaining aspect ratio
  const scale = Math.min(
    (windowWidth - 16) / PAGE_WIDTH, // 16 = horizontal padding
    windowHeight / PAGE_HEIGHT
  ) * 0.95; // 95% of max possible scale to ensure it fits

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="automatic"
    >
      {/* Page Container - White Background */}
      <View
        style={[
          styles.pageContainer,
          {
            width: PAGE_WIDTH * scale,
            height: PAGE_HEIGHT * scale,
            maxWidth: '100%',
          },
        ]}
      >
        {/* Base Image - Brightened */}
        <Image
          source={{ uri: state.imageUri }}
          style={[
            styles.baseImage,
            {
              width: '100%',
              height: '100%',
              opacity: 0.95,
            },
          ]}
          resizeMode="contain"
          onError={(error) => {
            console.error('[MushafPage] Image load error:', error.nativeEvent.error);
            setState(prev => ({
              ...prev,
              error: 'Failed to load image',
            }));
          }}
        />

        {/* Word Overlay - SVG with text strokes for visibility */}
        {state.wordBoxes.length > 0 && (
          <Svg
            width={PAGE_WIDTH * scale}
            height={PAGE_HEIGHT * scale}
            viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`}
            style={styles.svgOverlay}
          >
            {/* Optional: semi-transparent white background behind text */}
            <Rect
              x="0"
              y="0"
              width={PAGE_WIDTH}
              height={PAGE_HEIGHT}
              fill="rgba(255, 255, 255, 0.02)"
            />

            {/* Render tajweed overlays for words when available */}
            {state.wordBoxes.map((box, i) => {
              try {
                const parts = box.verseKey.split(':');
                const s = Number(parts[0]);
                const a = Number(parts[1]);
                const p = Number(parts[2]);
                const key = `${s}:${a}`;
                // tajweedMap passed inside each box as _tajweedKeyMap (Map of key->Map)
                const outer = (box as any)._tajweedKeyMap as Map<string, Map<number, any>> | undefined;
                const posMap = outer?.get(key);
                const wordInfo = posMap ? posMap.get(p) : null;
                if (wordInfo && wordInfo.tajweed_codes && tajweedConfig.enabled) {
                  // pick first rule from bitmap that is in default priority order
                  const ruleOrder: TajweedRule[] = [
                    TajweedRule.IKHFA,
                    TajweedRule.GHUNNA,
                    TajweedRule.IDHAR,
                    TajweedRule.IQLAB,
                    TajweedRule.IDGHAAM,
                    TajweedRule.QALQALA,
                    TajweedRule.SUKUN,
                  ];
                  let chosenRule: TajweedRule | null = null;
                  for (let idx = 0; idx < ruleOrder.length; idx++) {
                    const r = ruleOrder[idx];
                    if ((wordInfo.tajweed_codes & (1 << idx)) !== 0 && tajweedConfig.highlightedRules.includes(r)) {
                      chosenRule = r;
                      break;
                    }
                  }
                  if (chosenRule) {
                    const color = TAJWEED_COLORS[chosenRule].hexColor || '#ff0';
                      // If the user selected the 'rq-color' style (or the CDN style is available),
                      // prefer rendering the remote tajweed overlay image provided by tarteel's CDN.
                      if (tajweedConfig.style === 'rq-color') {
                        const surah = s;
                        const ayah = a;
                        const pos = p;
                        // Build URL: e.g. https://static-cdn.tarteel.ai/qul/images/w/rq-color/4/1/16.png
                        const imgUrl = `https://static-cdn.tarteel.ai/qul/images/w/rq-color/${surah}/${ayah}/${pos}.png`;
                        return (
                          <React.Fragment key={`tajweed-img-${i}`}>
                            <SvgImage
                              x={box.x}
                              y={box.y}
                              width={box.width}
                              height={box.height}
                              preserveAspectRatio="none"
                              // @ts-ignore - react-native-svg typings sometimes expect href as any
                              href={{ uri: imgUrl }}
                            />
                            {tajweedConfig.showLabels && (
                              <SvgText x={box.x + 2} y={box.y + 12} fontSize={10} fill="#fff">{TAJWEED_COLORS[chosenRule].color}</SvgText>
                            )}
                          </React.Fragment>
                        );
                      }

                      // Fallback: simple colored rectangle
                      return (
                        <React.Fragment key={`tajweed-${i}`}>
                          <Rect
                            x={box.x}
                            y={box.y}
                            width={box.width}
                            height={box.height}
                            fill={color}
                            opacity={Math.max(0.1, Math.min(0.9, tajweedConfig.opacity))}
                          />
                          {tajweedConfig.showLabels && (
                            <SvgText x={box.x + 2} y={box.y + 12} fontSize={10} fill="#fff">{TAJWEED_COLORS[chosenRule].color}</SvgText>
                          )}
                        </React.Fragment>
                      );
                  }
                }
                return null;
              } catch (e) {
                return null;
              }
            })}

            {/* Debug info removed for production: page indicator hidden */}
          </Svg>
        )}
      </View>

    </ScrollView>
  );
}

/**
 * Get the image URI for a page
 */
async function getPageImageUri(pageNumber: number): Promise<string | null> {
  const candidates = [
    `${IMAGES_DIR}/page_${pageNumber}.png`,
    `${IMAGES_DIR}/${pageNumber}.png`,
    `${IMAGES_DIR}/page_${String(pageNumber).padStart(3, '0')}.png`,
  ];

  console.log(`[getPageImageUri] Checking candidates for page ${pageNumber}:`);
  for (const path of candidates) {
    try {
      const exists = await RNFS.exists(path);
      console.log(`  ${exists ? '✅' : '❌'} ${path.split('/').pop()}`);
      if (exists) {
        // Normalize to a file:// URI when possible
        return ensureFileUri(path) as string;
      }
    } catch (e) {
      console.warn(`[getPageImageUri] Error checking ${path}:`, e);
    }
  }

  return null;
}

/**
 * Load word coordinates from JSON file
 */
async function loadWordCoordinates(pageNumber: number): Promise<WordBox[]> {
  try {
    const jsonPath = `${JSON_DIR}/${pageNumber}.json`;
    console.log(`[loadWordCoordinates] Loading: ${jsonPath}`);
    
    const exists = await RNFS.exists(jsonPath);

    if (!exists) {
      console.warn(`[loadWordCoordinates] JSON not found: ${pageNumber}.json`);
      return [];
    }

    const content = await RNFS.readFile(jsonPath, 'utf8');
    const coordinates = JSON.parse(content);

    // Transform to WordBox format
    const wordBoxes: WordBox[] = Object.entries(coordinates).map(
      ([verseKey, coords]: [string, any]) => ({
        verseKey,
        x: coords.x,
        y: coords.y,
        width: coords.w,
        height: coords.h,
      })
    );

    console.log(`[loadWordCoordinates] ✅ Loaded ${wordBoxes.length} coordinates`);
    return wordBoxes;
  } catch (err) {
    console.error(`[loadWordCoordinates] Error:`, err);
    return [];
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 20,
  },
  pageContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    // Ensure the container is sized to fit the content
    alignSelf: 'center',
  },
  baseImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#ffffff',
  },
  svgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  loadingText: {
    color: '#FFA500',
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  debugText: {
    color: '#999',
    fontSize: 10,
    marginTop: 8,
    fontFamily: 'Courier New',
  },
});

export default MushafPage;

