import React from 'react';

export type ModalVariant = 'default' | 'gold' | 'purple' | 'green' | 'custom';

export type ModalIcon = 'sajdah' | 'mosque' | 'star' | 'quran' | 'trophy' | 'custom';

export interface ActionButton {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
}

export interface InfoBadge { label: string; icon?: React.ReactNode }

export interface QuranThemedModalProps {
  visible: boolean;
  onClose: () => void;

  variant?: ModalVariant;
  customGradient?: [string, string];

  icon?: ModalIcon;
  customIcon?: React.ReactNode;
  iconColor?: string;
  showIconGlow?: boolean;

  title: string;
  subtitle?: string;
  arabicText?: string;
  arabicTranslation?: string;
  bodyText?: string;
  children?: React.ReactNode;

  badges?: InfoBadge[];

  showTopOrnament?: boolean;
  showDivider?: boolean;
  showStarPattern?: boolean;

  primaryButton?: ActionButton | null;
  secondaryButton?: ActionButton | null;
  tertiaryButton?: { label: string; onPress: () => void } | null;

  dismissable?: boolean;
  closeOnPrimaryPress?: boolean;
  closeOnSecondaryPress?: boolean;

  animationDuration?: number;

  accessibilityLabel?: string;
  testID?: string;
}

export default QuranThemedModalProps;
