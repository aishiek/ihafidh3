/**
 * Calendar Service for FastingCalendar
 * Handles calendar generation and fasting day calculations
 */

import { CalendarDay, FastingType, FastingInfo, FastingLocation, HijriDate, GregorianDate } from '@/types/fasting';
import { FastingApiService } from './apiService';

export class FastingCalendarService {
  // Fasting type configurations
  private static readonly FASTING_INFO: Record<FastingType, FastingInfo> = {
    [FastingType.AYYAMUL_BIDH]: {
      type: FastingType.AYYAMUL_BIDH,
      name: 'Ayyamul Bidh',
      description: '13th, 14th, 15th of Hijri month',
      color: '#10B981',
      priority: 5,
    },
    [FastingType.MONDAY_THURSDAY]: {
      type: FastingType.MONDAY_THURSDAY,
      name: 'Monday & Thursday',
      description: 'Sunnah fasting on Mondays and Thursdays',
      color: '#3B82F6',
      priority: 3,
    },
    [FastingType.MUHARRAM]: {
      type: FastingType.MUHARRAM,
      name: 'Muharram',
      description: 'Sacred month fasting',
      color: '#8B5CF6',
      priority: 7,
    },
    [FastingType.ASHURA]: {
      type: FastingType.ASHURA,
      name: 'Ashura',
      description: '10th of Muharram',
      color: '#DC2626',
      priority: 10,
    },
    [FastingType.ARAFAH]: {
      type: FastingType.ARAFAH,
      name: 'Arafah',
      description: '9th of Dhul Hijjah',
      color: '#F59E0B',
      priority: 9,
    },
    [FastingType.SHAWWAL]: {
      type: FastingType.SHAWWAL,
      name: 'Shawwal',
      description: '6 days of Shawwal',
      color: '#06B6D4',
      priority: 8,
    },
    [FastingType.DHUL_HIJJAH_FIRST_TEN]: {
      type: FastingType.DHUL_HIJJAH_FIRST_TEN,
      name: 'First 10 of Dhul Hijjah',
      description: 'First 10 days of Dhul Hijjah',
      color: '#EC4899',
      priority: 6,
    },
    [FastingType.RAMADAN]: {
      type: FastingType.RAMADAN,
      name: 'Ramadan',
      description: 'Holy month of fasting',
      color: '#059669',
      priority: 10,
    },
  };

  /**
   * Generate calendar days for a specific month
   */
  static async generateCalendarDays(
    month: Date,
    location?: FastingLocation,
    hijriAdjustment: number = 0
  ): Promise<CalendarDay[]> {
    try {
      const year = month.getFullYear();
      const monthIndex = month.getMonth();

      // Get Hijri calendar data for the month
      const hijriData = await FastingApiService.getHijriCalendar(year, monthIndex + 1, location);

      const calendarDays: CalendarDay[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Process each day in the month
      for (const dayData of hijriData) {
        const gregorianDate = new Date(dayData.gregorian.date);
        gregorianDate.setHours(0, 0, 0, 0);

        // Apply Hijri adjustment
        const adjustedHijriDate = this.adjustHijriDate(dayData.hijri, hijriAdjustment);

        // Determine fasting types for this day
        const fastingTypes = this.determineFastingTypes(
          gregorianDate,
          adjustedHijriDate
        );

        const calendarDay: CalendarDay = {
          date: dayData.gregorian.date,
          hijriDate: adjustedHijriDate,
          gregorianDate: dayData.gregorian,
          fastingTypes,
          isToday: gregorianDate.getTime() === today.getTime(),
          isCurrentMonth: gregorianDate.getMonth() === monthIndex,
        };

        calendarDays.push(calendarDay);
      }

      return calendarDays;
    } catch (error) {
      console.error('Error generating calendar days:', error);
      throw error;
    }
  }

  /**
   * Generate fallback calendar days (offline mode)
   */
  static generateFallbackCalendarDays(month: Date): CalendarDay[] {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const calendarDays: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
      const gregorianDate = new Date(year, monthIndex, day);
      gregorianDate.setHours(0, 0, 0, 0);

      // Generate basic fasting types (Monday/Thursday only)
      const fastingTypes: FastingType[] = [];
      const dayOfWeek = gregorianDate.getDay();
      
      if (dayOfWeek === 1 || dayOfWeek === 4) {
        fastingTypes.push(FastingType.MONDAY_THURSDAY);
      }

      // Create mock Hijri date
      const mockHijriDate: HijriDate = {
        date: gregorianDate.toISOString().split('T')[0],
        format: 'DD-MM-YYYY',
        day: day.toString(),
        weekday: { en: gregorianDate.toLocaleDateString('en', { weekday: 'long' }), ar: '' },
        month: { number: 1, en: 'Unknown', ar: '' },
        year: '1440',
        designation: { abbreviated: 'AH', expanded: 'Anno Hegirae' },
        holidays: [],
      };

      const calendarDay: CalendarDay = {
        date: gregorianDate.toISOString().split('T')[0],
        hijriDate: mockHijriDate,
        gregorianDate: {
          date: gregorianDate.toISOString().split('T')[0],
          format: 'DD-MM-YYYY',
          day: day.toString(),
          weekday: { en: gregorianDate.toLocaleDateString('en', { weekday: 'long' }) },
          month: { number: monthIndex + 1, en: gregorianDate.toLocaleDateString('en', { month: 'long' }) },
          year: year.toString(),
          designation: { abbreviated: 'CE', expanded: 'Common Era' },
        },
        fastingTypes,
        isToday: gregorianDate.getTime() === today.getTime(),
        isCurrentMonth: true,
      };

      calendarDays.push(calendarDay);
    }

    return calendarDays;
  }

  /**
   * Determine fasting types for a specific date
   */
  private static determineFastingTypes(
    gregorianDate: Date,
    hijriDate: HijriDate
  ): FastingType[] {
    const fastingTypes: FastingType[] = [];

    // Monday & Thursday fasting
    const dayOfWeek = gregorianDate.getDay();
    if (dayOfWeek === 1 || dayOfWeek === 4) {
      fastingTypes.push(FastingType.MONDAY_THURSDAY);
    }

    // Ayyamul Bidh (13th, 14th, 15th of Hijri month)
    const hijriDay = parseInt(hijriDate.day);
    if (hijriDay === 13 || hijriDay === 14 || hijriDay === 15) {
      fastingTypes.push(FastingType.AYYAMUL_BIDH);
    }

    // Muharram (1st month of Hijri calendar)
    if (hijriDate.month.number === 1) {
      fastingTypes.push(FastingType.MUHARRAM);
      
      // Ashura (10th of Muharram)
      if (hijriDay === 10) {
        fastingTypes.push(FastingType.ASHURA);
      }
    }

    // Dhul Hijjah (12th month)
    if (hijriDate.month.number === 12) {
      // First 10 days of Dhul Hijjah
      if (hijriDay <= 10) {
        fastingTypes.push(FastingType.DHUL_HIJJAH_FIRST_TEN);
      }
      
      // Arafah (9th of Dhul Hijjah)
      if (hijriDay === 9) {
        fastingTypes.push(FastingType.ARAFAH);
      }
    }

    // Shawwal (10th month) - 6 days after Eid
    if (hijriDate.month.number === 10 && hijriDay >= 2 && hijriDay <= 7) {
      fastingTypes.push(FastingType.SHAWWAL);
    }

    // Ramadan (9th month) - special handling
    if (hijriDate.month.number === 9) {
      fastingTypes.push(FastingType.RAMADAN);
    }

    return fastingTypes;
  }

  /**
   * Apply Hijri date adjustment
   */
  private static adjustHijriDate(hijriDate: HijriDate, adjustment: number): HijriDate {
    if (adjustment === 0) {
      return hijriDate;
    }

    // Create adjusted date
    const adjustedDay = parseInt(hijriDate.day) + adjustment;
    
    return {
      ...hijriDate,
      day: Math.max(1, adjustedDay).toString(),
    };
  }

  /**
   * Get fasting info for a specific type
   */
  static getFastingInfo(type: FastingType): FastingInfo {
    return this.FASTING_INFO[type];
  }

  /**
   * Get all fasting types info
   */
  static getAllFastingInfo(): FastingInfo[] {
    return Object.values(this.FASTING_INFO);
  }

  /**
   * Get fasting types for a specific day
   */
  static getFastingTypesForDate(
    gregorianDate: Date,
    hijriDate: HijriDate
  ): FastingType[] {
    return this.determineFastingTypes(gregorianDate, hijriDate);
  }
}
