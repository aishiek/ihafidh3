/**
 * FastingCalendar Types
 * Integrated into iHafidh2 with mixed state management support
 */

export interface HijriDate {
  date: string;
  format: string;
  day: string;
  weekday: {
    en: string;
    ar: string;
  };
  month: {
    number: number;
    en: string;
    ar: string;
  };
  year: string;
  designation: {
    abbreviated: string;
    expanded: string;
  };
  holidays: string[];
}

export interface GregorianDate {
  date: string;
  format: string;
  day: string;
  weekday: {
    en: string;
  };
  month: {
    number: number;
    en: string;
  };
  year: string;
  designation: {
    abbreviated: string;
    expanded: string;
  };
}

export interface CalendarDay {
  date: string;
  hijriDate: HijriDate;
  gregorianDate: GregorianDate;
  fastingTypes: FastingType[];
  isToday: boolean;
  isCurrentMonth: boolean;
}

export enum FastingType {
  AYYAMUL_BIDH = 'ayyamul_bidh',
  MONDAY_THURSDAY = 'monday_thursday',
  MUHARRAM = 'muharram',
  ASHURA = 'ashura',
  ARAFAH = 'arafah',
  SHAWWAL = 'shawwal',
  DHUL_HIJJAH_FIRST_TEN = 'dhul_hijjah_first_ten',
  RAMADAN = 'ramadan' // Special case - handled separately in the UI
}

export interface FastingInfo {
  type: FastingType;
  name: string;
  description: string;
  color: string;
  priority: number; // Higher number = higher priority for display
}

export interface FastingLocation {
  country: string;
  city: string;
  latitude?: number;
  longitude?: number;
}

export interface FastingIntention {
  date: string;
  intention: 'will_fast' | 'completed' | 'none';
  notes?: string;
}

export interface FastingTypeNotification {
  enabled: boolean;
  time: string; // HH:MM format
  beforeDays: number; // How many days before to notify
}

export interface FastingNotificationSettings {
  enabled: boolean;
  defaultTime: string; // Default time in HH:MM format
  defaultBeforeDays: number; // Default days before to notify
  fastingTypes: {
    [key in FastingType]?: FastingTypeNotification;
  };
}

export interface FastingAppSettings {
  theme: 'light' | 'dark';
  colorScheme: 'blue' | 'green' | 'purple' | 'orange';
  location: FastingLocation;
  notifications: FastingNotificationSettings;
  language: 'en' | 'ar';
  hijriAdjustment?: -1 | 0 | 1;
}

export interface AladhanResponse {
  code: number;
  status: string;
  data: {
    gregorian: GregorianDate;
    hijri: HijriDate;
  }[];
}

// Enhanced types for iHafidh2 integration
export interface FastingCalendarState {
  settings: FastingAppSettings;
  currentMonth: Date;
  calendarDays: CalendarDay[];
  fastingIntentions: Record<string, FastingIntention>;
  isLoading: boolean;
  error: string | null;
}

export type FastingCalendarAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CALENDAR_DAYS'; payload: CalendarDay[] }
  | { type: 'SET_CURRENT_MONTH'; payload: Date }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<FastingAppSettings> }
  | { type: 'SET_FASTING_INTENTION'; payload: FastingIntention }
  | { type: 'LOAD_FASTING_INTENTIONS'; payload: Record<string, FastingIntention> };

// Integration interfaces for mixed state management
export interface FastingContextType {
  state: FastingCalendarState;
  dispatch: React.Dispatch<FastingCalendarAction>;
  loadCalendarData: (month: Date) => Promise<void>;
  setFastingIntention: (intention: FastingIntention) => Promise<void>;
  updateSettings: (settings: Partial<FastingAppSettings>) => Promise<void>;
}

export interface FastingThemeContextType {
  state: {
    settings: {
      theme: 'light' | 'dark';
      colorScheme: 'blue' | 'green' | 'purple' | 'orange';
    };
  };
  updateSettings: (settings: any) => Promise<void>;
}
