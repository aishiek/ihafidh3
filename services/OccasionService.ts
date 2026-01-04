import { OCCASION_COMPONENT_MAP, OCCASIONS_FLAG_URL } from '@/utils/occasionUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';

const CACHE_KEY = '@occasion_cache';
const CACHE_DURATION = 21600000; // 6 hours
const LAST_CHECK_KEY = '@occasion_last_check';

export type OccasionData = {
    id: string;
    active: boolean;
    expiresAt?: string;
    IconComponent: React.ComponentType<any>;
    displayName?: string;
    description?: string;
};

export interface OccasionConfig {
    isFeatureEnabled: boolean;
    activeOccasionId: string;
    occasions: Array<{
        id: string;
        active: boolean;
        expiresAt?: string;
        name?: string;
        description?: string;
    }>;
}

/**
 * Centralized service for fetching and caching Islamic occasion data
 * Prevents duplicate network requests and provides offline support
 */
export class OccasionService {
    private static cachedOccasion: OccasionData | null = null;
    private static lastCheckTime: number = 0;
    private static fetchPromise: Promise<OccasionData | null> | null = null;

    /**
     * Fetch active occasion with caching and request deduplication
     */
    static async getActiveOccasion(): Promise<OccasionData | null> {
        // ✅ Deduplicate concurrent requests
        if (this.fetchPromise) {
            console.log('[OccasionService] Reusing in-flight request');
            return this.fetchPromise;
        }

        try {
            const now = Date.now();

            // Return cached data if fresh
            if (this.cachedOccasion && (now - this.lastCheckTime) < CACHE_DURATION) {
                console.log('[OccasionService] Using cached occasion');
                return this.cachedOccasion;
            }

            // Start new fetch
            this.fetchPromise = this._fetchFromRemote();
            const result = await this.fetchPromise;

            this.fetchPromise = null;
            this.lastCheckTime = now;
            this.cachedOccasion = result;

            // Cache to AsyncStorage for offline support
            if (result) {
                await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
                    id: result.id,
                    active: result.active,
                    expiresAt: result.expiresAt,
                    displayName: result.displayName,
                    description: result.description,
                }));
                await AsyncStorage.setItem(LAST_CHECK_KEY, now.toString());
            }

            return result;
        } catch (error) {
            this.fetchPromise = null;
            console.error('[OccasionService] Fetch failed:', error);

            // ✅ Fallback to last cached data
            return this._getLastCached();
        }
    }

    /**
     * Internal fetch logic with timeout and validation
     */
    private static async _fetchFromRemote(): Promise<OccasionData | null> {
        // ✅ Add 10s timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(OCCASIONS_FLAG_URL, {
                cache: 'no-cache',
                headers: { 'Cache-Control': 'no-cache' },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            // ✅ Validate schema
            if (typeof data.isFeatureEnabled !== 'boolean') {
                console.warn('[OccasionService] Invalid schema: missing isFeatureEnabled');
                return null;
            }

            // ✅ CRITICAL: Check global feature flag first
            if (data.isFeatureEnabled !== true) {
                console.log('[OccasionService] Feature disabled globally');
                return null;
            }

            if (!Array.isArray(data.occasions)) {
                console.warn('[OccasionService] Invalid schema: occasions must be array');
                return null;
            }

            // Find active occasion
            const activeId = data.activeOccasionId;
            const occasions = data.occasions || [];
            const activeOccasion = occasions.find((occ: any) => occ.id === activeId);

            if (!activeOccasion) {
                console.log('[OccasionService] No active occasion found');
                return null;
            }

            // Check expiration
            if (activeOccasion.expiresAt) {
                const expiresAt = new Date(activeOccasion.expiresAt).getTime();
                if (Date.now() > expiresAt) {
                    console.log('[OccasionService] Active occasion expired');
                    return null;
                }
            }

            // Get icon component
            const IconComponent = OCCASION_COMPONENT_MAP[activeOccasion.id];
            if (!IconComponent) {
                console.warn(`[OccasionService] No icon component for '${activeOccasion.id}'`);
                return null;
            }

            return {
                id: activeOccasion.id,
                active: true,
                expiresAt: activeOccasion.expiresAt,
                IconComponent,
                displayName: activeOccasion.actionData?.title || activeOccasion.name,
                description: activeOccasion.actionData?.message || activeOccasion.description,
            };
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Get last cached occasion (offline fallback)
     */
    private static async _getLastCached(): Promise<OccasionData | null> {
        try {
            const cached = await AsyncStorage.getItem(CACHE_KEY);
            if (!cached) return null;

            const parsed = JSON.parse(cached);

            // Validate expiration
            if (parsed.expiresAt) {
                const expiresAt = new Date(parsed.expiresAt).getTime();
                if (Date.now() > expiresAt) {
                    console.log('[OccasionService] Cached occasion expired');
                    await AsyncStorage.removeItem(CACHE_KEY);
                    return null;
                }
            }

            // Restore IconComponent (lost during JSON serialization)
            if (parsed.id && OCCASION_COMPONENT_MAP[parsed.id]) {
                parsed.IconComponent = OCCASION_COMPONENT_MAP[parsed.id];
                return parsed as OccasionData;
            }

            return null;
        } catch (error) {
            console.error('[OccasionService] Cache read failed:', error);
            return null;
        }
    }

    /**
     * Clear cache (for testing/debugging)
     */
    static async clearCache(): Promise<void> {
        try {
            await AsyncStorage.removeItem(CACHE_KEY);
            await AsyncStorage.removeItem(LAST_CHECK_KEY);
            this.cachedOccasion = null;
            this.lastCheckTime = 0;
            console.log('[OccasionService] Cache cleared');
        } catch (error) {
            console.error('[OccasionService] Cache clear failed:', error);
        }
    }
}

export default OccasionService;
