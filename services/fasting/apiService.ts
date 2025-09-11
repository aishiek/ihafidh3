/**
 * API Service for FastingCalendar
 * Handles Hijri calendar and Islamic date calculations
 */

import { AladhanResponse, HijriDate, GregorianDate, FastingLocation } from '@/types/fasting';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class FastingApiService {
  private static readonly BASE_URL = 'https://api.aladhan.com/v1';
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private static cache = new Map<string, { data: any; timestamp: number }>();

  /**
   * Get Hijri calendar data for a specific month
   */
  static async getHijriCalendar(
    year: number,
    month: number,
    location?: FastingLocation
  ): Promise<{ gregorian: GregorianDate; hijri: HijriDate }[]> {
    const cacheKey = `hijri-${year}-${month}-${location?.country || 'default'}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      let url = `${this.BASE_URL}/gToHCalendar/${month}/${year}`;
      
      if (location?.latitude && location?.longitude) {
        url += `?latitude=${location.latitude}&longitude=${location.longitude}`;
      } else if (location?.city && location?.country) {
        url += `?city=${encodeURIComponent(location.city)}&country=${encodeURIComponent(location.country)}`;
      }

      const response = await fetch(url);
      const data: AladhanResponse = await response.json();

      if (data.code !== 200) {
        throw new Error(`API Error: ${data.status}`);
      }

      // Cache the result
      this.cache.set(cacheKey, {
        data: data.data,
        timestamp: Date.now()
      });

      return data.data;
    } catch (error) {
      console.error('Error fetching Hijri calendar:', error);
      throw error;
    }
  }

  /**
   * Get current Hijri date
   */
  static async getCurrentHijriDate(location?: FastingLocation): Promise<{ gregorian: GregorianDate; hijri: HijriDate }> {
    const now = new Date();
    const cacheKey = `current-hijri-${now.toDateString()}-${location?.country || 'default'}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      let url = `${this.BASE_URL}/gToH/${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
      
      if (location?.latitude && location?.longitude) {
        url += `?latitude=${location.latitude}&longitude=${location.longitude}`;
      } else if (location?.city && location?.country) {
        url += `?city=${encodeURIComponent(location.city)}&country=${encodeURIComponent(location.country)}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.code !== 200) {
        throw new Error(`API Error: ${data.status}`);
      }

      // Cache the result
      this.cache.set(cacheKey, {
        data: data.data,
        timestamp: Date.now()
      });

      return data.data;
    } catch (error) {
      console.error('Error fetching current Hijri date:', error);
      throw error;
    }
  }

  /**
   * Convert Gregorian date to Hijri
   */
  static async gregorianToHijri(
    gregorianDate: Date,
    location?: FastingLocation
  ): Promise<{ gregorian: GregorianDate; hijri: HijriDate }> {
    const cacheKey = `g-to-h-${gregorianDate.toDateString()}-${location?.country || 'default'}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      let url = `${this.BASE_URL}/gToH/${gregorianDate.getDate()}-${gregorianDate.getMonth() + 1}-${gregorianDate.getFullYear()}`;
      
      if (location?.latitude && location?.longitude) {
        url += `?latitude=${location.latitude}&longitude=${location.longitude}`;
      } else if (location?.city && location?.country) {
        url += `?city=${encodeURIComponent(location.city)}&country=${encodeURIComponent(location.country)}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.code !== 200) {
        throw new Error(`API Error: ${data.status}`);
      }

      // Cache the result
      this.cache.set(cacheKey, {
        data: data.data,
        timestamp: Date.now()
      });

      return data.data;
    } catch (error) {
      console.error('Error converting Gregorian to Hijri:', error);
      throw error;
    }
  }

  /**
   * Get current location using expo-location
   */
  static async getCurrentLocation(): Promise<FastingLocation | null> {
    try {
      // Dynamically import expo-location to avoid import errors on web
      const { getCurrentPositionAsync, requestForegroundPermissionsAsync } = await import('expo-location');
      
      const { status } = await requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission not granted');
        return null;
      }

      const location = await getCurrentPositionAsync({
        accuracy: 6, // Balanced accuracy
        timeInterval: 10000, // 10 seconds
        distanceInterval: 100 // 100 meters
      });
      
      const { latitude, longitude } = location.coords;
      
      // Try to reverse geocode to get city/country
      // For now, return a default location based on region approximation
      const approximateLocation = this.approximateLocationFromCoords(latitude, longitude);
      
      return {
        city: approximateLocation.city,
        country: approximateLocation.country,
        latitude,
        longitude
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      
      // If expo-location is not available (web platform), try browser geolocation
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              const approximateLocation = this.approximateLocationFromCoords(latitude, longitude);
              resolve({
                city: approximateLocation.city,
                country: approximateLocation.country,
                latitude,
                longitude
              });
            },
            (error) => {
              console.warn('Browser geolocation failed:', error);
              resolve(null);
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 300000 // 5 minutes
            }
          );
        });
      }
      
      return null;
    }
  }

  /**
   * Simple approximation of location based on coordinates
   * In production, use a proper geocoding service
   */
  private static approximateLocationFromCoords(
    latitude: number, 
    longitude: number
  ): { city: string; country: string } {
    // Simple regional approximations
    // Middle East
    if (latitude >= 12 && latitude <= 42 && longitude >= 34 && longitude <= 60) {
      if (latitude >= 21 && latitude <= 32 && longitude >= 34 && longitude <= 55) {
        return { city: 'Riyadh', country: 'Saudi Arabia' };
      }
      return { city: 'Cairo', country: 'Egypt' };
    }
    
    // Southeast Asia
    if (latitude >= -10 && latitude <= 28 && longitude >= 92 && longitude <= 141) {
      if (latitude >= 1 && latitude <= 7 && longitude >= 103 && longitude <= 104) {
        return { city: 'Singapore', country: 'Singapore' };
      }
      if (latitude >= 2 && latitude <= 7 && longitude >= 100 && longitude <= 119) {
        return { city: 'Kuala Lumpur', country: 'Malaysia' };
      }
      return { city: 'Jakarta', country: 'Indonesia' };
    }
    
    // South Asia
    if (latitude >= 6 && latitude <= 37 && longitude >= 60 && longitude <= 97) {
      if (latitude >= 23 && latitude <= 37 && longitude >= 60 && longitude <= 77) {
        return { city: 'Karachi', country: 'Pakistan' };
      }
      if (latitude >= 20 && latitude <= 28 && longitude >= 88 && longitude <= 92) {
        return { city: 'Dhaka', country: 'Bangladesh' };
      }
      return { city: 'Mumbai', country: 'India' };
    }
    
    // Europe
    if (latitude >= 35 && latitude <= 71 && longitude >= -25 && longitude <= 45) {
      return { city: 'London', country: 'United Kingdom' };
    }
    
    // North America
    if (latitude >= 14 && latitude <= 83 && longitude >= -179 && longitude <= -52) {
      return { city: 'New York', country: 'United States' };
    }
    
    // Default fallback
    return { city: 'Mecca', country: 'Saudi Arabia' };
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}
