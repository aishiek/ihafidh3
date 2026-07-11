// contexts/CelebrationContext.tsx
import { CelebrationMessage, CelebrationType } from '@/components/CelebrationModal';
import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';

interface CelebrationContextType {
  celebrationVisible: boolean;
  celebrationType: CelebrationType;
  customMessage?: CelebrationMessage;
  badgeName?: string;
  showCelebration: (type: CelebrationType, message?: CelebrationMessage, badge?: string) => void;
  hideCelebration: () => void;
}

const CelebrationContext = createContext<CelebrationContextType | undefined>(undefined);

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [celebrationType, setCelebrationType] = useState<CelebrationType>('quiz');
  const [customMessage, setCustomMessage] = useState<CelebrationMessage | undefined>();
  const [badgeName, setBadgeName] = useState<string | undefined>();

  const showCelebration = useCallback((
    type: CelebrationType,
    message?: CelebrationMessage,
    badge?: string
  ) => {
    if (__DEV__) console.log(`🎉 [CelebrationContext] Showing ${type}${badge ? ` - ${badge}` : ''}`);
    setCelebrationType(type);
    setCustomMessage(message);
    setBadgeName(badge);
    setCelebrationVisible(true);
  }, []);

  const hideCelebration = useCallback(() => {
    if (__DEV__) console.log('👋 [CelebrationContext] Hiding celebration');
    setCelebrationVisible(false);
    setCustomMessage(undefined);
    setBadgeName(undefined);
  }, []);

  return (
    <CelebrationContext.Provider
      value={{
        celebrationVisible,
        celebrationType,
        customMessage,
        badgeName,
        showCelebration,
        hideCelebration,
      }}
    >
      {children}
    </CelebrationContext.Provider>
  );
}

export function useCelebration() {
  const context = useContext(CelebrationContext);
  if (!context) {
    throw new Error('useCelebration must be used within CelebrationProvider');
  }
  return context;
}
