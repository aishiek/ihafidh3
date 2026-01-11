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

// Color mapping constants - Metallic Inlay Tajweed Palette (Ultra-Premium)
export const TAJWEED_COLORS: Record<TajweedRule, TajweedColor> = {
  [TajweedRule.IKHFA]: {
    rule: TajweedRule.IKHFA,
    color: 'purple',
    hexColor: '#A78BFA',
    description: 'Ikhfa (Concealment)',
    arDescription: 'الإخفاء',
  },
  [TajweedRule.GHUNNA]: {
    rule: TajweedRule.GHUNNA,
    color: 'orange',
    hexColor: '#F97316',
    description: 'Ghunna (Nasalization)',
    arDescription: 'الغنة',
  },
  [TajweedRule.IDHAR]: {
    rule: TajweedRule.IDHAR,
    color: 'gray',
    hexColor: '#9CA3AF',
    description: 'Idhar (Clarification)',
    arDescription: 'الإظهار',
  },
  [TajweedRule.IQLAB]: {
    rule: TajweedRule.IQLAB,
    color: 'blue',
    hexColor: '#3B82F6',
    description: 'Iqlab (Substitution)',
    arDescription: 'الإقلاب',
  },
  [TajweedRule.IDGHAAM]: {
    rule: TajweedRule.IDGHAAM,
    color: 'green',
    hexColor: '#10B981',
    description: 'Idghaam (Merging)',
    arDescription: 'الإدغام',
  },
  [TajweedRule.QALQALA]: {
    rule: TajweedRule.QALQALA,
    color: 'red',
    hexColor: '#EF4444',
    description: 'Qalqala (Vibration)',
    arDescription: 'القلقلة',
  },
  [TajweedRule.SUKUN]: {
    rule: TajweedRule.SUKUN,
    color: 'bronze',
    hexColor: '#B45309',
    description: 'Sukun (No Vowel)',
    arDescription: 'السكون',
  },
};
