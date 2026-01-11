export enum TajweedRule {
  IKHFA = 'ikhfa',           // Concealment - Green
  GHUNNA = 'ghunna',         // Nasalization - Red
  IDHAR = 'idhar',           // Clarification - Blue
  IQLAB = 'iqlab',           // Substitution - Purple
  IDGHAAM = 'idghaam',       // Merging - Yellow
  QALQALA = 'qalqala',       // Vibration - Orange
  SUKUN = 'sukun',           // No vowel - Amber
}

export interface TajweedColor {
  rule: TajweedRule;
  color: string;
  hexColor: string;
  description: string;
  arDescription: string;
}

export interface WordWithTajweed {
  word_id: number;
  word_text: string;
  tajweed_codes: number;  // Bitmap: bit 0=ikhfa, bit 1=ghunna, etc.
  surah_number: number;
  ayah_number: number;
  position_in_ayah: number;
}

export interface TajweedConfig {
  enabled: boolean;
  highlightedRules: TajweedRule[];
  showLabels: boolean;
  opacity: number;  // 0.3 - 1.0
  // Optional rendering style; e.g. 'rq-color' to use remote tarteel.ai images
  style?: string;
}

// Color mapping constants
export const TAJWEED_COLORS: Record<TajweedRule, TajweedColor> = {
  [TajweedRule.IKHFA]: {
    rule: TajweedRule.IKHFA,
    color: 'emerald',
    hexColor: '#10b981',
    description: 'Ikhfa (Concealment)',
    arDescription: 'الإخفاء',
  },
  [TajweedRule.GHUNNA]: {
    rule: TajweedRule.GHUNNA,
    color: 'red',
    hexColor: '#ef4444',
    description: 'Ghunna (Nasalization)',
    arDescription: 'الغنة',
  },
  [TajweedRule.IDHAR]: {
    rule: TajweedRule.IDHAR,
    color: 'blue',
    hexColor: '#3b82f6',
    description: 'Idhar (Clarification)',
    arDescription: 'الإظهار',
  },
  [TajweedRule.IQLAB]: {
    rule: TajweedRule.IQLAB,
    color: 'purple',
    hexColor: '#a855f7',
    description: 'Iqlab (Substitution)',
    arDescription: 'الإقلاب',
  },
  [TajweedRule.IDGHAAM]: {
    rule: TajweedRule.IDGHAAM,
    color: 'yellow',
    hexColor: '#eab308',
    description: 'Idghaam (Merging)',
    arDescription: 'الإدغام',
  },
  [TajweedRule.QALQALA]: {
    rule: TajweedRule.QALQALA,
    color: 'orange',
    hexColor: '#f97316',
    description: 'Qalqala (Vibration)',
    arDescription: 'القلقلة',
  },
  [TajweedRule.SUKUN]: {
    rule: TajweedRule.SUKUN,
    color: 'amber',
    hexColor: '#b45309',
    description: 'Sukun (No Vowel)',
    arDescription: 'السكون',
  },
};
