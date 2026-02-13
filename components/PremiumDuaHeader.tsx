import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface PremiumDuaHeaderProps {
    stats: {
        perfect: number;
        memorized: number;
        revised: number;
        new: number;
        total: number;
    };
}

export function PremiumDuaHeader({ stats }: PremiumDuaHeaderProps) {
    const memorizedCount = stats.memorized + stats.perfect;
    const progress = stats.total > 0 ? (memorizedCount / stats.total) * 100 : 0;

    return (
        <View style={styles.outerContainer}>
            <View style={styles.card}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Quranic Duas</Text>
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <StatBox
                        label="MEMORIZED"
                        value={memorizedCount}
                        color="#10B981"
                        borderColor="#064E3B"
                    />
                    <StatBox
                        label="REVISED"
                        value={stats.revised}
                        color="#3B82F6"
                        borderColor="#1E3A8A"
                    />
                    <StatBox
                        label="PENDING"
                        value={stats.new}
                        color="#F59E0B"
                        borderColor="#78350F"
                    />
                </View>

                {/* Progress Bar Container */}
                <View style={styles.progressSection}>
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                    </View>
                    <Text style={styles.progressText}>
                        {memorizedCount} of {stats.total} {stats.total === 1 ? 'dua' : 'duas'} memorized ({Math.round(progress)}%)
                    </Text>
                </View>
            </View>
        </View>
    );
}

function StatBox({ label, value, color, borderColor }: { label: string, value: number, color: string, borderColor: string }) {
    return (
        <View style={[styles.statBox, { borderColor: '#1F2937' }]}>
            {/* Colored Top Accent */}
            <View style={[styles.topAccent, { backgroundColor: color }]} />

            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    outerContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 24,
    },
    card: {
        backgroundColor: '#0F172A',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#1F2937',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'serif',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between',
    },
    statBox: {
        flex: 1,
        backgroundColor: '#020617',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        position: 'relative',
        overflow: 'hidden',
    },
    topAccent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
    },
    statValue: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    progressSection: {
        marginTop: 24,
    },
    progressBarBg: {
        height: 8,
        backgroundColor: '#020617',
        borderRadius: 4,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#1F2937',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#10B981',
        borderRadius: 4,
    },
    progressText: {
        fontSize: 13,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 12,
        fontWeight: '500',
    },
});
