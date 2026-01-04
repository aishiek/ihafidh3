import { OccasionService } from '@/services/OccasionService';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Hook to fetch and monitor active Islamic occasion
 * Uses centralized OccasionService to prevent duplicate fetches
 */
export const useIslamicOccasion = () => {
    const [occasionData, setOccasionData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [appState, setAppState] = useState(AppState.currentState);

    // Monitor app state changes
    useEffect(() => {
        const subscription = AppState.addEventListener('change', setAppState);
        return () => subscription.remove();
    }, []);

    useEffect(() => {
        let mounted = true;
        let interval;

        const fetchOccasion = async () => {
            // Only fetch when app is active (save battery)
            if (appState !== 'active') return;

            try {
                if (mounted) setLoading(true);

                const data = await OccasionService.getActiveOccasion();

                if (mounted) {
                    setOccasionData(data);
                    setLoading(false);
                }
            } catch (error) {
                console.error('[useIslamicOccasion] Fetch failed:', error);
                if (mounted) {
                    setOccasionData(null);
                    setLoading(false);
                }
            }
        };

        // Initial fetch
        fetchOccasion();

        // Poll every 6 hours (only when app is active)
        interval = setInterval(fetchOccasion, 21600000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [appState]);

    return { occasionData, loading };
};
