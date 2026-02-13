import { DetailedDuaCard } from '@/components/DetailedDuaCard';
import QURANIC_DUAS_DATA from '@/data/quranic-duas.json';
import { fetchVersesByIds, JuzVerse } from '@/services/juzDbService';
import { useProgressStore } from '@/store/progressStore';
import { useThemeStore } from '@/store/themeStore';
import type { QuranicDua } from '@/types/duas';
import { calculateDuaStats, getDuaStatus, getVerseId } from '@/utils/duaHelpers';
import { useThemeColor } from '@/utils/useThemeColor';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { ChevronLeft, Clock, RefreshCw, Star } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const QURANIC_DUAS = QURANIC_DUAS_DATA as QuranicDua[];
const CATEGORIES = ['All', 'Rabbana', 'Prophetic', 'Knowledge', 'Family', 'Hardship', 'Protection'] as const;

export default function QuranicDuasScreen() {
    const { theme } = useThemeStore();
    const { primary } = useThemeColor();
    const memorizedVerses = useProgressStore(state => state.memorizedVerses);
    const revisedVerses = useProgressStore(state => state.revisedVerses);

    const [selectedCategory, setSelectedCategory] = useState<typeof CATEGORIES[number]>('All');
    const [versesData, setVersesData] = useState<Record<number, JuzVerse>>({});
    const [isLoading, setIsLoading] = useState(true);

    // Calculate stats
    const stats = useMemo(() => {
        return calculateDuaStats(QURANIC_DUAS, memorizedVerses, revisedVerses);
    }, [memorizedVerses, revisedVerses]);

    // Filter duas by category
    const filteredDuas = useMemo(() => {
        if (selectedCategory === 'All') return QURANIC_DUAS;
        return QURANIC_DUAS.filter(dua =>
            dua.category === selectedCategory ||
            dua.subcategory === selectedCategory
        );
    }, [selectedCategory]);


    // Effect to fetch full verse text for all duas
    useEffect(() => {
        const loadDuaVerses = async () => {
            try {
                // Collect all verse IDs needed (including ranges)
                const verseIdsSet = new Set<number>();
                QURANIC_DUAS.forEach(d => {
                    const start = getVerseId(d.surahNumber, d.verseNumber);
                    if (d.verseNumberEnd) {
                        const end = getVerseId(d.surahNumber, d.verseNumberEnd);
                        for (let id = start; id <= end; id++) {
                            verseIdsSet.add(id);
                        }
                    } else {
                        verseIdsSet.add(start);
                    }
                });

                const verses = await fetchVersesByIds(Array.from(verseIdsSet));
                const dbVerseMap: Record<number, JuzVerse> = {};
                verses.forEach(v => { dbVerseMap[v.verse_id] = v; });

                // Construct a map that represents the "dua view" of these verses
                // For multi-verse duas, we merge the content
                const mergedMap: Record<number, JuzVerse> = {};
                QURANIC_DUAS.forEach(d => {
                    const startId = getVerseId(d.surahNumber, d.verseNumber);
                    if (d.verseNumberEnd) {
                        const endId = getVerseId(d.surahNumber, d.verseNumberEnd);
                        const rangeVerses: JuzVerse[] = [];
                        for (let id = startId; id <= endId; id++) {
                            if (dbVerseMap[id]) rangeVerses.push(dbVerseMap[id]);
                        }

                        mergedMap[startId] = {
                            verse_id: startId,
                            chapter_id: d.surahNumber,
                            verse_number: d.verseNumber,
                            ayah: rangeVerses.map(rv => rv.ayah).join(' '),
                            translation: rangeVerses.map(rv => rv.translation).join(' '),
                            transliteration: rangeVerses.map(rv => rv.transliteration).join(' ')
                        };
                    } else {
                        mergedMap[startId] = dbVerseMap[startId];
                    }
                });

                setVersesData(mergedMap);
            } catch (e) {
                console.error("Failed to load dua verses", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadDuaVerses();
    }, []);

    const navigateToDua = (dua: QuranicDua) => {
        const vid = getVerseId(dua.surahNumber, dua.verseNumber);
        router.push({
            pathname: '/(tabs)/read',
            params: {
                surahId: dua.surahNumber.toString(),
                verseId: vid.toString(),
                verseEnd: dua.verseNumberEnd ? getVerseId(dua.surahNumber, dua.verseNumberEnd).toString() : undefined,
                source: 'quranic_duas'
            }
        });
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Quranic Duas',
                    headerStyle: { backgroundColor: '#05080F' }, // Deep Obsidian
                    headerTintColor: '#D4AF37', // Gold
                    headerTitleStyle: { fontWeight: 'bold', fontFamily: 'serif' },
                    headerShadowVisible: false,
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/index')}
                            style={{ marginLeft: Platform.OS === 'ios' ? 0 : 4, padding: 8 }}
                        >
                            <ChevronLeft size={28} color="#D4AF37" />
                        </TouchableOpacity>
                    ),
                }}
            />

            {/* Main Background Gradient */}
            <LinearGradient
                colors={['#05080F', '#111827']}
                style={styles.backgroundGradient}
            >
                <FlatList
                    data={filteredDuas}
                    keyExtractor={item => item.id}
                    ListHeaderComponent={
                        <View style={styles.headerComponent}>
                            {/* Minimal Stats Strip */}
                            <View style={styles.statsStrip}>
                                <View style={styles.statItem}>
                                    <View style={[styles.statIconBadge, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
                                        <Star size={14} color="#D4AF37" fill="#D4AF37" />
                                    </View>
                                    <View>
                                        <Text style={styles.statValue}>{stats.memorized}</Text>
                                        <Text style={styles.statLabel}>Memorized</Text>
                                    </View>
                                </View>

                                <View style={styles.statDivider} />

                                <View style={styles.statItem}>
                                    <View style={[styles.statIconBadge, { backgroundColor: 'rgba(33, 150, 243, 0.1)' }]}>
                                        <RefreshCw size={14} color="#2196F3" />
                                    </View>
                                    <View>
                                        <Text style={styles.statValue}>{stats.revised}</Text>
                                        <Text style={styles.statLabel}>Revised</Text>
                                    </View>
                                </View>

                                <View style={styles.statDivider} />

                                <View style={styles.statItem}>
                                    <View style={[styles.statIconBadge, { backgroundColor: 'rgba(148, 163, 184, 0.1)' }]}>
                                        <Clock size={14} color="#94A3B8" />
                                    </View>
                                    <View>
                                        <Text style={styles.statValue}>{stats.pending}</Text>
                                        <Text style={styles.statLabel}>Pending</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.progressSummary}>
                                <Text style={styles.progressSummaryText}>
                                    <Text style={{ color: '#D4AF37', fontWeight: 'bold' }}>{stats.memorized}</Text> of {stats.total} duas memorized
                                </Text>
                            </View>

                            {/* Category Filter Pills */}
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.categoryScroll}
                                style={styles.categoryContainer}
                            >
                                {CATEGORIES.map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        onPress={() => setSelectedCategory(cat)}
                                        style={[
                                            styles.categoryChip,
                                            selectedCategory === cat && styles.categoryChipSelected
                                        ]}
                                    >
                                        <Text style={[
                                            styles.categoryChipText,
                                            selectedCategory === cat && styles.categoryChipTextSelected
                                        ]}>
                                            {cat}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    }
                    renderItem={({ item }) => {
                        // Get status
                        const status = getDuaStatus(item.surahNumber, item.verseNumber, memorizedVerses, revisedVerses);
                        // Get full verse data
                        const verseId = getVerseId(item.surahNumber, item.verseNumber);
                        const verse = versesData[verseId];

                        return (
                            <DetailedDuaCard
                                dua={item}
                                verseData={verse || {}} // Pass empty obj if loading
                                status={status}
                                onPress={() => navigateToDua(item)}
                                theme={theme}
                            />
                        );
                    }}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#05080F',
    },
    backgroundGradient: {
        flex: 1,
    },
    categoryContainer: {
        marginBottom: 24,
    },
    categoryScroll: {
        paddingHorizontal: 16,
        gap: 12,
    },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(51, 65, 85, 0.5)', // Slate-700 transparent
        borderWidth: 1,
        borderColor: '#334155',
    },
    categoryChipSelected: {
        backgroundColor: '#D4AF37', // Gold
        borderColor: '#D4AF37',
    },
    categoryChipText: {
        color: '#94A3B8', // Slate-400
        fontWeight: '600',
        fontSize: 14,
    },
    categoryChipTextSelected: {
        color: '#0B1221', // Dark Navy
        fontWeight: 'bold',
    },
    listContent: {
        paddingBottom: 40,
    },
    headerComponent: {
        paddingTop: 16,
    },
    statsStrip: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        marginHorizontal: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.1)',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    statIconBadge: {
        width: 30,
        height: 30,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statValue: {
        color: '#F8FAFC',
        fontSize: 16,
        fontWeight: 'bold',
        lineHeight: 18,
    },
    statLabel: {
        color: '#94A3B8',
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statDivider: {
        width: 1,
        height: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    progressSummary: {
        alignItems: 'center',
        marginBottom: 20,
    },
    progressSummaryText: {
        color: '#94A3B8',
        fontSize: 13,
    },
});
