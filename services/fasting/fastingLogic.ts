import { CalendarDay, FastingType, HijriDate } from '@/types/fasting';

export class FastingLogic {
  static getFastingTypesForDay(hijriDate: HijriDate, gregorianDate: Date): FastingType[] {
    const fastingTypes: FastingType[] = [];
    const hijriDay = parseInt(hijriDate.day);
    const hijriMonth = hijriDate.month.number;
    const weekday = gregorianDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Ayyamul Bidh: 13th, 14th, 15th of each lunar month
    // EXCEPTION: not observed in Dhul Hijjah (month 12)
    if (hijriMonth !== 12 && hijriDay >= 13 && hijriDay <= 15) {
      fastingTypes.push(FastingType.AYYAMUL_BIDH);
    }

    // Monday and Thursday
    if (weekday === 1 || weekday === 4) { // Monday = 1, Thursday = 4
      fastingTypes.push(FastingType.MONDAY_THURSDAY);
    }

    // First 10 days of Muharram
    if (hijriMonth === 1 && hijriDay <= 10) {
      fastingTypes.push(FastingType.MUHARRAM);
    }

    // Ashura: 9th and 10th of Muharram
    if (hijriMonth === 1 && (hijriDay === 9 || hijriDay === 10)) {
      fastingTypes.push(FastingType.ASHURA);
    }

    // First 10 days of Dhul Hijjah (1-10)
    if (hijriMonth === 12 && hijriDay >= 1 && hijriDay <= 10) {
      fastingTypes.push(FastingType.DHUL_HIJJAH_FIRST_TEN);
    }

    // Day of Arafah: 9th of Dhul Hijjah
    if (hijriMonth === 12 && hijriDay === 9) {
      fastingTypes.push(FastingType.ARAFAH);
    }

    // Six days of Shawwal (after Eid al-Fitr)
    // This is more complex as it depends on when Eid al-Fitr occurs
    // For now, we'll mark the first 6 days of Shawwal
    if (hijriMonth === 10 && hijriDay <= 6) {
      fastingTypes.push(FastingType.SHAWWAL);
    }

    return fastingTypes;
  }

  static getFastingDescription(fastingTypes: FastingType[]): string {
    if (fastingTypes.length === 0) {
      return 'No recommended fasting today';
    }

    const descriptions = fastingTypes.map(type => {
      switch (type) {
        case FastingType.AYYAMUL_BIDH:
          return 'Ayyamul Bidh (13th-15th of lunar month)';
        case FastingType.MONDAY_THURSDAY:
          return 'Monday/Thursday fasting';
        case FastingType.MUHARRAM:
          return 'Muharram fasting (first 10 days)';
        case FastingType.ASHURA:
          return 'Ashura fasting (9th & 10th Muharram)';
        case FastingType.ARAFAH:
          return 'Day of Arafah (9th Dhul Hijjah)';
        case FastingType.SHAWWAL:
          return 'Six days of Shawwal';
        default:
          return 'Recommended fasting';
      }
    });

    return descriptions.join(', ');
  }

  static getFastingBenefits(fastingTypes: FastingType[]): string[] {
    const benefits: string[] = [];
    
    if (fastingTypes.includes(FastingType.AYYAMUL_BIDH)) {
      benefits.push('Ayyamul Bidh fasting is equivalent to fasting the whole year');
    }
    
    if (fastingTypes.includes(FastingType.MONDAY_THURSDAY)) {
      benefits.push('Monday and Thursday are the days when deeds are presented to Allah');
    }
    
    if (fastingTypes.includes(FastingType.ASHURA)) {
      benefits.push('Fasting on Ashura expiates the sins of the previous year');
    }
    
    if (fastingTypes.includes(FastingType.ARAFAH)) {
      benefits.push('Fasting on the Day of Arafah expiates the sins of two years');
    }
    
    if (fastingTypes.includes(FastingType.SHAWWAL)) {
      benefits.push('Six days of Shawwal are like fasting the whole year');
    }

    return benefits;
  }

  static shouldHighlightDay(fastingTypes: FastingType[]): boolean {
    return fastingTypes.length > 0;
  }

  static getPrimaryFastingType(fastingTypes: FastingType[]): FastingType | null {
    if (fastingTypes.length === 0) return null;
    
    // Return the type with highest priority
    return fastingTypes.reduce((prev, current) => {
      const prevPriority = this.getFastingPriority(prev);
      const currentPriority = this.getFastingPriority(current);
      return currentPriority > prevPriority ? current : prev;
    });
  }

  private static getFastingPriority(type: FastingType): number {
    const priorities = {
      [FastingType.RAMADAN]: 10,
      [FastingType.ARAFAH]: 6,
      [FastingType.ASHURA]: 5,
      [FastingType.SHAWWAL]: 4,
      [FastingType.DHUL_HIJJAH_FIRST_TEN]: 3,
      [FastingType.MUHARRAM]: 3,
      [FastingType.MONDAY_THURSDAY]: 2,
      [FastingType.AYYAMUL_BIDH]: 1
    };
    
    return priorities[type] || 0;
  }
}


