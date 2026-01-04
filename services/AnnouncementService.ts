import { AnnouncementConfig } from '@/components/AnnouncementModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANNOUNCEMENT_STORAGE_KEY = '@announcement_seen_ids';
const VERSION_URL = 'https://aishiek.github.io/version.json';
const CACHE_DURATION = 3600000; // 1 hour
const LAST_CHECK_KEY = '@announcement_last_check';
const LAST_ANNOUNCEMENT_KEY = '@announcement_last_successful'; // ✅ Offline support

export class AnnouncementService {
  private static cachedAnnouncement: AnnouncementConfig | null = null;
  private static lastCheckTime: number = 0;

  static async fetchAnnouncement(): Promise<AnnouncementConfig | null> {
    try {
      const now = Date.now();
      if (this.cachedAnnouncement && (now - this.lastCheckTime) < CACHE_DURATION) {
        console.log('[Announcement] Using cached announcement');
        return this.cachedAnnouncement;
      }

      console.log('[Announcement] Fetching from server...');

      // ✅ Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const response = await fetch(VERSION_URL, {
          cache: 'no-cache',
          headers: { 'Cache-Control': 'no-cache' },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const announcement = data.announcement as AnnouncementConfig | undefined;

        if (!announcement || !announcement.active) {
          console.log('[Announcement] No active announcement');
          this.cachedAnnouncement = null;
          return null;
        }

        // Check expiration
        if (announcement.expiresAt) {
          const expiresAt = new Date(announcement.expiresAt).getTime();
          if (Date.now() > expiresAt) {
            console.log('[Announcement] Announcement expired');
            this.cachedAnnouncement = null;
            return null;
          }
        }

        this.cachedAnnouncement = announcement;
        this.lastCheckTime = now;
        await AsyncStorage.setItem(LAST_CHECK_KEY, now.toString());

        // ✅ Cache last successful announcement for offline use
        await this.cacheLastAnnouncement(announcement);

        console.log('[Announcement] Fetched:', announcement.id);
        return announcement;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      console.error('[Announcement] Fetch failed:', error);

      // ✅ Return cached announcement as fallback if available
      if (this.cachedAnnouncement) {
        console.log('[Announcement] Using stale cache due to network error');
        return this.cachedAnnouncement;
      }

      // ✅ Try to load last successful announcement from storage
      const lastCached = await this.getLastCachedAnnouncement();
      if (lastCached) {
        console.log('[Announcement] Using last cached announcement (offline mode)');
        return lastCached;
      }

      return null;
    }
  }

  static async shouldShow(announcement: AnnouncementConfig): Promise<boolean> {
    try {
      if (announcement.showOnce) {
        const seenIds = await this.getSeenAnnouncementIds();
        if (seenIds.includes(announcement.id)) {
          console.log('[Announcement] Already seen (showOnce):', announcement.id);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('[Announcement] shouldShow check failed:', error);
      return true; // fail-open
    }
  }

  static async markAsSeen(announcementId: string): Promise<void> {
    try {
      const seenIds = await this.getSeenAnnouncementIds();
      if (!seenIds.includes(announcementId)) {
        seenIds.push(announcementId);
        await AsyncStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, JSON.stringify(seenIds));
        console.log('[Announcement] Marked as seen:', announcementId);
      }
    } catch (error) {
      console.error('[Announcement] Failed to mark as seen:', error);
    }
  }

  private static async getSeenAnnouncementIds(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(ANNOUNCEMENT_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[Announcement] Failed to get seen IDs:', error);
      return [];
    }
  }

  static async clearSeenAnnouncements(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ANNOUNCEMENT_STORAGE_KEY);
      console.log('[Announcement] Cleared seen announcements');
    } catch (error) {
      console.error('[Announcement] Failed to clear:', error);
    }
  }

  static async getAnnouncementToDisplay(): Promise<AnnouncementConfig | null> {
    try {
      const announcement = await this.fetchAnnouncement();
      if (!announcement) return null;
      const shouldShow = await this.shouldShow(announcement);
      if (!shouldShow) return null;
      return announcement;
    } catch (error) {
      console.error('[Announcement] getAnnouncementToDisplay failed:', error);
      return null;
    }
  }

  // ✅ Offline support: Cache last successful announcement
  private static async cacheLastAnnouncement(announcement: AnnouncementConfig): Promise<void> {
    try {
      await AsyncStorage.setItem(LAST_ANNOUNCEMENT_KEY, JSON.stringify(announcement));
      console.log('[Announcement] Cached for offline use:', announcement.id);
    } catch (error) {
      console.error('[Announcement] Cache failed:', error);
    }
  }

  private static async getLastCachedAnnouncement(): Promise<AnnouncementConfig | null> {
    try {
      const data = await AsyncStorage.getItem(LAST_ANNOUNCEMENT_KEY);
      if (!data) return null;

      const announcement = JSON.parse(data) as AnnouncementConfig;

      // Check if cached announcement is expired
      if (announcement.expiresAt) {
        const expiresAt = new Date(announcement.expiresAt).getTime();
        if (Date.now() > expiresAt) {
          console.log('[Announcement] Cached announcement expired');
          return null;
        }
      }

      return announcement;
    } catch (error) {
      console.error('[Announcement] Failed to get cached announcement:', error);
      return null;
    }
  }

  // ✅ Analytics/Telemetry support
  static async trackAnnouncementView(announcementId: string): Promise<void> {
    try {
      console.log('[Announcement] Viewed:', announcementId);
      // TODO: Add analytics service integration
      // await Analytics.logEvent('announcement_viewed', { id: announcementId });
    } catch (error) {
      console.error('[Announcement] Tracking failed:', error);
    }
  }

  static async trackAnnouncementAction(announcementId: string, action: 'dismissed' | 'clicked'): Promise<void> {
    try {
      console.log('[Announcement] Action:', action, announcementId);
      // TODO: Add analytics service integration
      // await Analytics.logEvent('announcement_action', { id: announcementId, action });
    } catch (error) {
      console.error('[Announcement] Action tracking failed:', error);
    }
  }
}

export default AnnouncementService;
