declare module 'rn-tajweed-verse' {
  import { ComponentType } from 'react';
  
  interface TajweedVerseProps {
    verse: string;
    config?: {
      style?: {
        fontSize?: number;
        lineHeight?: number;
        color?: string;
        direction?: 'rtl' | 'ltr';
        fontFamily?: string;
      };
      tajweed?: Record<string, {
        style?: any;
        onPress?: (() => void) | null;
      }>;
    };
  }
  
  const TajweedVerse: ComponentType<TajweedVerseProps>;
  export default TajweedVerse;
}
