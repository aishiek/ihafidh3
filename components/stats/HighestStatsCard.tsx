import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import { RotateCcw, TrendingUp } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface HighestStatsCardProps {
    highestMemorized: { count: number; date: string | null };
    highestRevised: { count: number; date: string | null };
}

const HighestStatsCard: React.FC<HighestStatsCardProps> = ({ highestMemorized, highestRevised }) => {
    const { theme: colors } = useUnifiedTheme();

    const formatDateLabel = (dateStr: string | null) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const StatBox = ({
        title,
        count,
        date,
        icon: Icon,
        iconBg,
        iconColor
    }: {
        title: string;
        count: number;
        date: string | null;
        icon: any;
        iconBg: string;
        iconColor: string;
    }) => (
        <View style={[styles.statBox, { borderColor: colors.border }]}>
            <View style={styles.statHeader}>
                <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
                    <Icon size={16} color={iconColor} />
                </View>
                <Text style={[styles.statTitle, { color: colors.textSecondary }]}>{title}</Text>
            </View>
            <View style={styles.statBody}>
                <View style={styles.countWrapper}>
                    <Text style={[styles.count, { color: iconColor }]}>{count}</Text>
                    <Text style={[styles.unit, { color: colors.textSecondary }]}>verses</Text>
                </View>
                {date && (
                    <Text style={[styles.date, { color: colors.textSecondary }]}>
                        {formatDateLabel(date)}
                    </Text>
                )}
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={[styles.mainTitle, { color: colors.text }]}>Highest in a Day</Text>
            <View style={styles.row}>
                <StatBox
                    title="Memorized"
                    count={highestMemorized.count}
                    date={highestMemorized.date}
                    icon={TrendingUp}
                    iconBg="rgba(78, 205, 196, 0.1)"
                    iconColor="#4ECDC4"
                />
                <StatBox
                    title="Revised"
                    count={highestRevised.count}
                    date={highestRevised.date}
                    icon={RotateCcw}
                    iconBg="rgba(255, 152, 0, 0.1)"
                    iconColor="#FFD700"
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
    },
    mainTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        marginLeft: 4,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    statBox: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    statHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    iconContainer: {
        width: 28,
        height: 28,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statTitle: {
        fontSize: 14,
        fontWeight: '500',
    },
    statBody: {
        paddingLeft: 4,
    },
    countWrapper: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
        marginBottom: 2,
    },
    count: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    unit: {
        fontSize: 12,
    },
    date: {
        fontSize: 12,
        opacity: 0.8,
    },
});

export default HighestStatsCard;
