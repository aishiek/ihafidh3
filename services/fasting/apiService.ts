/**
 * API Service for FastingCalendar
 * Handles Hijri calendar and Islamic date calculations
 */

import { AladhanResponse, FastingLocation, GregorianDate, HijriDate } from '@/types/fasting';
import * as Location from 'expo-location';

export class FastingApiService {
  private static readonly BASE_URL = 'https://api.aladhan.com/v1';
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private static cache = new Map<string, { data: any; timestamp: number }>();

  /** Get Hijri calendar data for a specific month */
  static async getHijriCalendar(
    year: number,
    month: number,
    location?: FastingLocation
  ): Promise<{ gregorian: GregorianDate; hijri: HijriDate }[]> {
    const cacheKey = `hijri-${year}-${month}-${location?.country || 'default'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) return cached.data;

    try {
      let url = `${this.BASE_URL}/gToHCalendar/${month}/${year}`;
      if (location?.latitude && location?.longitude) {
        url += `?latitude=${location.latitude}&longitude=${location.longitude}`;
      } else if (location?.city && location?.country) {
        url += `?city=${encodeURIComponent(location.city)}&country=${encodeURIComponent(location.country)}`;
      }

      const response = await fetch(url);
      const data: AladhanResponse = await response.json();

      if (data.code !== 200) throw new Error(`API Error: ${data.status}`);

      this.cache.set(cacheKey, { data: data.data, timestamp: Date.now() });
      return data.data;
    } catch (error) {
      console.error('Error fetching Hijri calendar:', error);
      throw error;
    }
  }

  /** Get current Hijri date */
  static async getCurrentHijriDate(location?: FastingLocation): Promise<{ gregorian: GregorianDate; hijri: HijriDate }> {
    const now = new Date();
    const cacheKey = `current-hijri-${now.toDateString()}-${location?.country || 'default'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) return cached.data;

    try {
      let url = `${this.BASE_URL}/gToH/${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
      if (location?.latitude && location?.longitude) {
        url += `?latitude=${location.latitude}&longitude=${location.longitude}`;
      } else if (location?.city && location?.country) {
        url += `?city=${encodeURIComponent(location.city)}&country=${encodeURIComponent(location.country)}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      if (data.code !== 200) throw new Error(`API Error: ${data.status}`);

      this.cache.set(cacheKey, { data: data.data, timestamp: Date.now() });
      return data.data;
    } catch (error) {
      console.error('Error fetching current Hijri date:', error);
      throw error;
    }
  }

  /** Convert Gregorian date to Hijri */
  static async gregorianToHijri(gregorianDate: Date, location?: FastingLocation): Promise<{ gregorian: GregorianDate; hijri: HijriDate }> {
    const cacheKey = `g-to-h-${gregorianDate.toDateString()}-${location?.country || 'default'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) return cached.data;

    try {
      let url = `${this.BASE_URL}/gToH/${gregorianDate.getDate()}-${gregorianDate.getMonth() + 1}-${gregorianDate.getFullYear()}`;
      if (location?.latitude && location?.longitude) {
        url += `?latitude=${location.latitude}&longitude=${location.longitude}`;
      } else if (location?.city && location?.country) {
        url += `?city=${encodeURIComponent(location.city)}&country=${encodeURIComponent(location.country)}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      if (data.code !== 200) throw new Error(`API Error: ${data.status}`);

      this.cache.set(cacheKey, { data: data.data, timestamp: Date.now() });
      return data.data;
    } catch (error) {
      console.error('Error converting Gregorian to Hijri:', error);
      throw error;
    }
  }

  /** Get current location using expo-location */
  static async getCurrentLocation(): Promise<FastingLocation | null> {
    try {
      if (!Location || !Location.requestForegroundPermissionsAsync) {
        console.warn('[location] module unavailable');
        return null;
      }
      const { status } = await Location.requestForegroundPermissionsAsync().catch(() => ({ status: 'denied' } as any));
      if (status !== 'granted') {
        console.warn('[location] permission denied');
        return null;
      }

      let loc: any = null;
      if (Location.getCurrentPositionAsync) {
        try {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy?.Balanced || 3, timeInterval: 10000, distanceInterval: 100 });
        } catch (e) {
          console.warn('[location] getCurrentPosition failed', e);
        }
      }
      if (!loc) {
        return null;
      }
      const { latitude, longitude } = loc.coords || { latitude: 0, longitude: 0 };
      const approximateLocation = this.approximateLocationFromCoords(latitude, longitude);
      return { city: approximateLocation.city, country: approximateLocation.country, latitude, longitude };
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  /** Approximate location from coordinates */
  private static approximateLocationFromCoords(latitude: number, longitude: number): { city: string; country: string } {
    if (latitude >= 12 && latitude <= 42 && longitude >= 34 && longitude <= 60) return { city: 'Riyadh', country: 'Saudi Arabia' };
    if (latitude >= -10 && latitude <= 28 && longitude >= 92 && longitude <= 141) return { city: 'Singapore', country: 'Singapore' };
    if (latitude >= 6 && latitude <= 37 && longitude >= 60 && longitude <= 97) return { city: 'Karachi', country: 'Pakistan' };
    if (latitude >= 35 && latitude <= 71 && longitude >= -25 && longitude <= 45) return { city: 'London', country: 'United Kingdom' };
    if (latitude >= 14 && latitude <= 83 && longitude >= -179 && longitude <= -52) return { city: 'New York', country: 'United States' };
    return { city: 'Mecca', country: 'Saudi Arabia' };
  }

  /** Clear cache */
  static clearCache(): void {
    this.cache.clear();
  }

  /** Get cache stats */
  static getCacheStats(): { size: number; keys: string[] } {
    return { size: this.cache.size, keys: Array.from(this.cache.keys()) };
  }
}
