/**
 * Location Service for FastingCalendar
 * Handles device location detection and city lookup
 */

import { FastingLocation } from '@/types/fasting';
import { COUNTRIES } from '@/constants/countries';

export class LocationService {
  /**
   * Get current location using browser geolocation API
   * For React Native/Expo, this would use expo-location
   */
  static async getCurrentLocation(): Promise<FastingLocation | null> {
    try {
      // For web platforms, use browser geolocation
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        return new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              
              // Try to reverse geocode to get city/country
              const location = await this.reverseGeocode(latitude, longitude);
              resolve(location);
            },
            (error) => {
              console.warn('Geolocation error:', error);
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
      
      // For native platforms without expo-location, return null
      // In a real implementation, you would use expo-location here
      console.warn('Geolocation not available on this platform');
      return null;
      
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  /**
   * Reverse geocode coordinates to get city/country
   * Uses a simple lookup or external API
   */
  private static async reverseGeocode(
    latitude: number, 
    longitude: number
  ): Promise<FastingLocation> {
    try {
      // For production, you might want to use a proper geocoding service
      // For now, we'll use a simple approximation based on major cities
      const location = this.approximateLocationFromCoords(latitude, longitude);
      
      return {
        city: location.city,
        country: location.country,
        latitude,
        longitude
      };
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      // Fallback to default location
      return {
        city: 'Singapore',
        country: 'Singapore',
        latitude,
        longitude
      };
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
    return { city: 'Singapore', country: 'Singapore' };
  }

  /**
   * Find closest city from our database based on name similarity
   */
  static findClosestCity(searchTerm: string): { city: string; country: string } | null {
    const normalizedSearch = searchTerm.toLowerCase().trim();
    
    // Find exact matches first
    for (const country of COUNTRIES) {
      for (const city of country.cities) {
        if (city.toLowerCase() === normalizedSearch) {
          return { city, country: country.name };
        }
      }
    }
    
    // Find partial matches
    for (const country of COUNTRIES) {
      for (const city of country.cities) {
        if (city.toLowerCase().includes(normalizedSearch) || 
            normalizedSearch.includes(city.toLowerCase())) {
          return { city, country: country.name };
        }
      }
    }
    
    return null;
  }
}
