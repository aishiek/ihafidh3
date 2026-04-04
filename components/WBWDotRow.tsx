/**
 * WBWDotRow.tsx
 *
 * One small gold dot per Arabic word. Non-intrusive during recitation.
 * Tap a dot → translation pill. Tap again → dismiss.
 *
 * Design rationale
 * ─────────────────────────────────────────────────────────────────
 * • Dots are 5px — visible but not distracting at reading distance.
 * • Hit slop is 12px vertically / 8px horizontally so they're easy
 *   to tap despite being visually tiny.
 * • RTL order: dot 0 is on the RIGHT (matches first Arabic word).
 *   Achieved with flexDirection: 'row-reverse'.
 * • Translation pill is reserved-height (placeholder View) so the
 *   card doesn't reflow when a word is selected/deselected.
 * • React.memo + primitive deps — safe inside FlashList.
 *
 * Word index mapping
 * ─────────────────────────────────────────────────────────────────
 * arabicText.split(/\s+/) → 0-based array
 * DB word_index                → 1-based
 * dot at array index i → word_index i + 1
 */

import { useWordByWord } from '@/hooks/useWordByWord';
import React, { useEffect, useState } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface WBWDotRowProps {
    arabicText: string;
    surahId: number;
    verseNumber: number;
    translationLanguage: string;
}

// ─── Single dot ───────────────────────────────────────────────────────────────

interface DotProps {
    index: number;
    isSelected: boolean;
    onPress: (index: number) => void;
}

const Dot = React.memo(({ index, isSelected, onPress }: DotProps) => (
    <TouchableOpacity
        onPress={() => onPress(index)}
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        style={styles.dotTouchable}
        activeOpacity={0.6}
    >
        <View style={[styles.dot, isSelected && styles.dotSelected]} />
    </TouchableOpacity>
));
Dot.displayName = 'WBWDot';

// ─── Main component ───────────────────────────────────────────────────────────

export const WBWDotRow = React.memo(({
    arabicText,
    surahId,
    verseNumber,
    translationLanguage,
}: WBWDotRowProps) => {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    // FIX 3: Reset the selected dot when FlashList recycles this component for a new verse.
    // Without this, the previously-selected dot index persists and shows the wrong word
    // highlighted on the recycled card.
    useEffect(() => {
        setSelectedIndex(null);
    }, [surahId, verseNumber]);

    const { wbwData, isLoading } = useWordByWord({
        surahId: surahId,
        ayah: verseNumber,
        translationLanguage,
        enabled: true,
    });

    // Word count from Arabic text — dots are derived from this, not wbwData.length,
    // so the row renders immediately even while wbwData is loading.
    const wordCount = arabicText.trim().split(/\s+/).length;

    const handleDotPress = (index: number) => {
        setSelectedIndex(prev => (prev === index ? null : index));
    };

    // word_index is 1-based in DB; dot index is 0-based
    const selectedTranslation: string | null =
        selectedIndex !== null
            ? (wbwData.find((w: any) => w.word_index === selectedIndex + 1)
                ?.translation ?? null)
            : null;

    // Don't mount until we know how many dots to draw
    if (wordCount === 0) return null;

    return (
        <View style={styles.container}>
            {/* Hairline separator */}
            <View style={styles.separator} />

            {/* Dot row — row-reverse so dot 0 is on the right (RTL) */}
            <View style={styles.dotsRow}>
                {Array.from({ length: wordCount }, (_, i) => (
                    <Dot
                        key={i}
                        index={i}
                        isSelected={selectedIndex === i}
                        onPress={handleDotPress}
                    />
                ))}
            </View>

            {/* Translation — fixed-height area to prevent layout shift */}
            <View style={styles.translationArea}>
                {selectedTranslation ? (
                    <View style={styles.translationPill}>
                        {/* Word position hint — "3 / 12" style */}
                        {selectedIndex !== null && (
                            <Text style={styles.wordPositionHint}>
                                {/* RTL: word 1 is rightmost, so visual position
                                    from right = selectedIndex + 1 */}
                                {selectedIndex + 1} / {wordCount}
                            </Text>
                        )}
                        <Text style={styles.translationText}>
                            {selectedTranslation}
                        </Text>
                    </View>
                ) : isLoading ? (
                    // Subtle pulse while loading — no ActivityIndicator flash
                    <Text style={styles.loadingHint}>· · ·</Text>
                ) : (
                    // Empty placeholder keeps height stable
                    null
                )}
            </View>
        </View>
    );
});

WBWDotRow.displayName = 'WBWDotRow';

// ─── Styles ───────────────────────────────────────────────────────────────────

const GOLD = '#D4AF37';
const GOLD_FAINT = 'rgba(212,175,55,0.28)';
const GOLD_MID = 'rgba(212,175,55,0.6)';
const GOLD_BRIGHT = 'rgba(212,175,55,0.95)';

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignItems: 'center',
        paddingTop: 6,
        paddingBottom: 2,
    },

    separator: {
        width: '40%',
        height: StyleSheet.hairlineWidth,
        backgroundColor: GOLD_FAINT,
        marginBottom: 8,
    },

    // row-reverse → dot index 0 renders on the RIGHT (RTL word order)
    dotsRow: {
        flexDirection: 'row-reverse',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
    },

    dotTouchable: {
        // Visual is tiny but touch target is generous via hitSlop
        width: 10,
        height: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },

    dot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: GOLD_FAINT,
    },

    dotSelected: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: GOLD_BRIGHT,
        // Subtle shadow gives the selected dot a "lit up" feel
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
        elevation: 3,
    },

    // Fixed height so card doesn't reflow on select/deselect
    translationArea: {
        minHeight: 38,
        marginTop: 6,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },

    translationPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 5,
        backgroundColor: 'rgba(5,8,15,0.85)',
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: GOLD_MID,
        maxWidth: '85%',
    },

    wordPositionHint: {
        fontSize: 10,
        color: GOLD_MID,
        fontWeight: '600',
        letterSpacing: 0.5,
        // Keeps the hint from pushing the translation text off-center
        flexShrink: 0,
    },

    translationText: {
        fontSize: 13,
        color: '#F0E6CC',
        fontStyle: 'italic',
        textAlign: 'center',
        lineHeight: 18,
        flexShrink: 1,
    },

    loadingHint: {
        fontSize: 12,
        color: GOLD_FAINT,
        letterSpacing: 4,
    },
});
