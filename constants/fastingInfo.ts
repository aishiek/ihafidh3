import { FastingInfo, FastingType } from '@/types/fasting';

export const FASTING_INFO: Record<FastingType, FastingInfo> = {
  [FastingType.AYYAMUL_BIDH]: {
    type: FastingType.AYYAMUL_BIDH,
    name: 'Ayyamul Bidh',
    description: 'The 13th, 14th, and 15th of each lunar month',
    color: '#3B82F6', // Blue - matching image
    priority: 1
  },
  [FastingType.MONDAY_THURSDAY]: {
    type: FastingType.MONDAY_THURSDAY,
    name: 'Mon/Thu',
    description: 'Recommended weekly fasting days',
    color: '#F97316', // Orange - matching image
    priority: 2
  },
  [FastingType.MUHARRAM]: {
    type: FastingType.MUHARRAM,
    name: 'Muharram',
    description: 'First 10 days of Muharram',
    color: '#7C3AED', // Violet
    priority: 3
  },
  [FastingType.ASHURA]: {
    type: FastingType.ASHURA,
    name: 'Ashura',
    description: '9th and 10th of Muharram (especially recommended)',
    color: '#DC2626', // Red
    priority: 4
  },
  [FastingType.ARAFAH]: {
    type: FastingType.ARAFAH,
    name: 'Day of Arafah',
    description: '9th of Dhul Hijjah',
    color: '#06B6D4', // Cyan
    priority: 5
  },
  [FastingType.SHAWWAL]: {
    type: FastingType.SHAWWAL,
    name: 'Shawwal',
    description: 'Six days after Eid al-Fitr',
    color: '#10B981', // Green - matching image
    priority: 6
  },
  [FastingType.DHUL_HIJJAH_FIRST_TEN]: {
    type: FastingType.DHUL_HIJJAH_FIRST_TEN,
    name: 'First 10 Dhul Hijjah',
    description: 'First 10 days of Dhul Hijjah (highly virtuous)',
    color: '#EC4899', // Pink
    priority: 3
  },
  [FastingType.RAMADAN]: {
    type: FastingType.RAMADAN,
    name: 'Ramadan',
    description: 'The holy month of Ramadan',
    color: '#065F46', // Dark green
    priority: 10
  }
};

export const FASTING_COLORS = {
  primary: '#059669', // Emerald
  secondary: '#D97706', // Amber
  accent: '#7C3AED', // Violet
  background: '#F8FAFC', // Slate 50
  surface: '#FFFFFF',
  surfaceElevated: '#F1F5F9', // Slate 100
  text: '#0F172A', // Slate 900
  textSecondary: '#475569', // Slate 600
  textMuted: '#94A3B8', // Slate 400
  border: '#E2E8F0', // Slate 200
  borderLight: '#F1F5F9', // Slate 100
  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB'
};

export const DARK_THEME_COLORS = {
  primary: '#10B981', // Emerald
  secondary: '#F59E0B', // Amber
  accent: '#8B5CF6', // Violet
  background: '#0F172A', // Slate 900
  surface: '#1E293B', // Slate 800
  surfaceElevated: '#334155', // Slate 700
  text: '#F8FAFC', // Slate 50
  textSecondary: '#CBD5E1', // Slate 300
  textMuted: '#64748B', // Slate 500
  border: '#334155', // Slate 700
  borderLight: '#475569', // Slate 600
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6'
};

// Color schemes
export const BLUE_THEME = {
  primary: '#3B82F6',
  accent: '#60A5FA',
  success: '#10B981'
};

export const GREEN_THEME = {
  primary: '#10B981',
  accent: '#34D399',
  success: '#059669'
};

export const PURPLE_THEME = {
  primary: '#8B5CF6',
  accent: '#A78BFA',
  success: '#7C3AED'
};

export const ORANGE_THEME = {
  primary: '#F97316',
  accent: '#FB923C',
  success: '#EA580C'
};
