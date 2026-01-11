/**
 * Tajweed Test Screen - HYBRID MODE + STOP RULES
 * Tests API tags + Algorithmic detection + Optional Qalqalah at stops
 * 
 * Modes:
 * - Quran.com (default): No qalqalah during wasl
 * - Mushaf mode: Show qalqalah at stops (waqf)
 */

import TajweedText from '@/components/TajweedText';
import { fetchSurahWithTajweed } from '@/services/quranApi';
import { debugTajweedParsing } from '@/utils/QuranTajweedParser';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Verse {
  id: number;
  verse_key: string;
  verse_number: number;
  text_uthmani: string;
  text_uthmani_tajweed: string;
}

export default function TajweedTestScreen() {
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSurah, setSelectedSurah] = useState(1);
  const [stopRulesEnabled, setStopRulesEnabled] = useState(false); // NEW: Toggle for Qalqalah

  useEffect(() => {
    loadSurah(selectedSurah);
  }, [selectedSurah]);

  const loadSurah = async (surahNum: number) => {
    setLoading(true);
    try {
      const data = await fetchSurahWithTajweed(surahNum);
      if (data) {
        setVerses(data.slice(0, 10)); // Show first 10 verses
        
        // DEBUG: Log first verse with stop rules option
        if (data[0] && __DEV__) {
          console.log('\n=== TAJWEED HYBRID TEST DEBUG ===');
          console.log('Surah:', surahNum);
          console.log('Verse 1 Key:', data[0].verse_key);
          console.log('Plain text:', data[0].text_uthmani.substring(0, 50));
          console.log('Tajweed HTML:', data[0].text_uthmani_tajweed.substring(0, 150));
          console.log('Has <tajweed> tags:', data[0].text_uthmani_tajweed.includes('<tajweed'));
          
          // Debug parse with stop rules option
          debugTajweedParsing(data[0].text_uthmani_tajweed, {
            enableAlgorithmic: true,
            enableStopRules: stopRulesEnabled,
          });
          console.log('========================\n');
        }
      }
    } catch (error) {
      console.error('Error loading surah:', error);
    } finally {
      setLoading(false);
    }
  };

  const testSurahs = [
    { id: 1, name: 'Al-Fatiha', description: 'Tests all rules' },
    { id: 112, name: 'Al-Ikhlas', description: '⭐ Qalqalah Test (RED)' },
    { id: 105, name: 'Al-Fil', description: 'Tests Qalqalah' },
    { id: 28, name: 'Al-Qasas (v53)', description: 'Tests Madd (ءَامَنَّا)' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#333' }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
          <Text style={{ color: '#FFD700', fontSize: 24 }}>←</Text>
        </Pressable>
        <Text style={{ color: '#FFD700', fontSize: 20, fontWeight: 'bold' }}>
          Tajweed Test
        </Text>
      </View>

      {/* Mode Toggle */}
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#333' }}>
        <Text style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
          Recitation Mode:
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => setStopRulesEnabled(false)}
            style={{
              flex: 1,
              padding: 12,
              backgroundColor: !stopRulesEnabled ? '#FFD700' : '#1a1a1a',
              borderRadius: 8,
            }}
          >
            <Text style={{
              color: !stopRulesEnabled ? '#000' : '#888',
              fontWeight: 'bold',
              textAlign: 'center',
            }}>
              Quran.com
            </Text>
            <Text style={{
              color: !stopRulesEnabled ? '#333' : '#666',
              fontSize: 10,
              textAlign: 'center',
              marginTop: 4,
            }}>
              Wasl (continuous)
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setStopRulesEnabled(true)}
            style={{
              flex: 1,
              padding: 12,
              backgroundColor: stopRulesEnabled ? '#FFD700' : '#1a1a1a',
              borderRadius: 8,
            }}
          >
            <Text style={{
              color: stopRulesEnabled ? '#000' : '#888',
              fontWeight: 'bold',
              textAlign: 'center',
            }}>
              Mushaf Mode
            </Text>
            <Text style={{
              color: stopRulesEnabled ? '#333' : '#666',
              fontSize: 10,
              textAlign: 'center',
              marginTop: 4,
            }}>
              🔴 Qalqalah at stops
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Surah Selector */}
      <View style={{ flexDirection: 'row', padding: 16, gap: 8 }}>
        {testSurahs.map((surah) => (
          <Pressable
            key={surah.id}
            onPress={() => setSelectedSurah(surah.id)}
            style={{
              flex: 1,
              padding: 12,
              backgroundColor: selectedSurah === surah.id ? '#FFD700' : '#1a1a1a',
              borderRadius: 8,
            }}
          >
            <Text style={{
              color: selectedSurah === surah.id ? '#000' : '#FFD700',
              fontWeight: 'bold',
              textAlign: 'center',
            }}>
              {surah.name}
            </Text>
            <Text style={{
              color: selectedSurah === surah.id ? '#333' : '#666',
              fontSize: 10,
              textAlign: 'center',
              marginTop: 4,
            }}>
              {surah.description}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={{ color: '#888', marginTop: 16 }}>Loading verses...</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1, padding: 20 }}>
          {verses.map((verse) => (
            <View key={verse.id} style={{ marginBottom: 30 }}>
              <Text style={{ color: '#888', marginBottom: 8, fontSize: 12 }}>
                Verse {verse.verse_number} ({verse.verse_key})
              </Text>
              
              <TajweedText
                text={verse.text_uthmani_tajweed}
                surahNumber={selectedSurah}
                verseNumber={verse.verse_number}
                style={{ fontSize: 28 }}
                enableStopRules={stopRulesEnabled}
              />
              
              {/* Show if using HTML or fallback */}
              {__DEV__ && (
                <Text style={{ color: '#444', fontSize: 10, marginTop: 4 }}>
                  Source: {verse.text_uthmani_tajweed.includes('<tajweed') ? 'API HTML ✅' : 'Fallback ⚠️'}
                </Text>
              )}
            </View>
          ))}

          {/* Color Legend */}
          <View style={{ marginTop: 40, padding: 16, backgroundColor: '#1a1a1a', borderRadius: 8 }}>
            <Text style={{ color: '#fff', marginBottom: 12, fontWeight: 'bold' }}>
              Tajweed Parsing Pipeline:
            </Text>
            
            <Text style={{ color: '#888', fontSize: 11, marginBottom: 12 }}>
              <Text style={{ fontWeight: 'bold' }}>Step 1:</Text> API tags (Quran.com rules - always valid during wasl)
            </Text>
            <Text style={{ color: '#888', fontSize: 11, marginBottom: 12 }}>
              <Text style={{ fontWeight: 'bold' }}>Step 2:</Text> Algorithmic wasl-safe rules (Ghunnah, Ikhfa, Idgham, Iqlab)
            </Text>
            <Text style={{ color: '#888', fontSize: 11, marginBottom: 16 }}>
              <Text style={{ fontWeight: 'bold' }}>Step 3:</Text> {stopRulesEnabled ? '✅ Stop rules enabled' : '❌ Stop rules disabled'} (Qalqalah at waqf)
            </Text>
            
            <View style={{ gap: 6 }}>
              <Text style={{ color: '#AAAAAA' }}>■ Silent Letters (Gray) - API</Text>
              <Text style={{ color: '#FF9632' }}>■ Madd (Orange) - API</Text>
              <Text style={{ color: '#FFD700' }}>■ Ghunnah (Yellow) - Algorithmic</Text>
              <Text style={{ color: '#FFB6C1' }}>■ Ikhfa (Pink) - Algorithmic</Text>
              <Text style={{ color: '#00C853' }}>■ Idgham (Green) - Algorithmic</Text>
              <Text style={{ color: '#007AFF' }}>■ Iqlab (Blue) - Algorithmic</Text>
              <Text style={{ color: '#DDA0DD' }}>■ Ikhfa Shafawi (Purple) - Algorithmic</Text>
              {stopRulesEnabled && (
                <Text style={{ color: '#DD0008', fontWeight: 'bold' }}>
                  ■ Qalqalah (Red) - Stop rule (waqf only) ⭐
                </Text>
              )}
            </View>
            
            {selectedSurah === 112 && stopRulesEnabled && (
              <View style={{ marginTop: 16, padding: 12, backgroundColor: '#1a0000', borderRadius: 4, borderWidth: 1, borderColor: '#DD0008' }}>
                <Text style={{ color: '#DD0008', fontWeight: 'bold', marginBottom: 4 }}>
                  ⚠️ QALQALAH WAQF TEST
                </Text>
                <Text style={{ color: '#888', fontSize: 11 }}>
                  In Mushaf mode, Surah Al-Ikhlas (112:1) ending "أَحَدٌ" should show RED on "د".
                  This is waqf-dependent (stop position) - NOT during wasl.
                </Text>
              </View>
            )}
            
            {!stopRulesEnabled && (
              <View style={{ marginTop: 16, padding: 12, backgroundColor: '#0a1a0a', borderRadius: 4, borderWidth: 1, borderColor: '#00C853' }}>
                <Text style={{ color: '#00C853', fontWeight: 'bold', marginBottom: 4 }}>
                  ✅ QURAN.COM MODE (Scholarly Correct)
                </Text>
                <Text style={{ color: '#888', fontSize: 11 }}>
                  Qalqalah disabled during wasl (continuous recitation).
                  Enable Mushaf mode to see stop-dependent rules.
                </Text>
              </View>
            )}
          </View>

          {/* Debug Info */}
          {__DEV__ && verses.length > 0 && (
            <View style={{ marginTop: 20, padding: 16, backgroundColor: '#1a1a1a', borderRadius: 8 }}>
              <Text style={{ color: '#FFD700', marginBottom: 8, fontWeight: 'bold' }}>
                Debug Info
              </Text>
              <Text style={{ color: '#888', fontSize: 11 }}>
                Total verses: {verses.length}
              </Text>
              <Text style={{ color: '#888', fontSize: 11 }}>
                First verse has HTML tags: {verses[0]?.text_uthmani_tajweed.includes('<tajweed') ? 'Yes ✅' : 'No ⚠️'}
              </Text>
              <Text style={{ color: '#888', fontSize: 11, marginTop: 8 }}>
                Sample HTML (first 100 chars):
              </Text>
              <Text style={{ color: '#666', fontSize: 10, fontFamily: 'monospace', marginTop: 4 }}>
                {verses[0]?.text_uthmani_tajweed.substring(0, 100)}...
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
