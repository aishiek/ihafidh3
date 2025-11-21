// ⚠️ DEPRECATED - Use @/contexts/CelebrationContext instead
// This file is kept for backward compatibility but will be removed in a future version
// All new code should use: import { useCelebration } from '@/contexts/CelebrationContext';

import { CelebrationType } from '@/components/CelebrationModal';
import { useCallback, useState } from 'react';

export interface CelebrationMessage {
  arabic: string;
  english: string;
  emoji: string;
}

/**
 * @deprecated Use useCelebration from @/contexts/CelebrationContext instead
 * This local hook does not provide global modal state
 */
export function useCelebration() {
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [celebrationType, setCelebrationType] = useState<CelebrationType>('quiz');
  const [customMessage, setCustomMessage] = useState<CelebrationMessage | undefined>();
  const [badgeName, setBadgeName] = useState<string | undefined>();

  const showCelebration = useCallback((
    type: CelebrationType, 
    message?: CelebrationMessage,
    badge?: string
  ) => {
    setCelebrationType(type);
    setCustomMessage(message);
    setBadgeName(badge);
    setCelebrationVisible(true);
    
    if (badge) {
      console.log(`🏆 [Celebration] Showing ${type} celebration for badge: ${badge}`);
    }
  }, []);

  const hideCelebration = useCallback(() => {
    setCelebrationVisible(false);
    setCustomMessage(undefined);
    setBadgeName(undefined);
  }, []);

  return {
    celebrationVisible,
    celebrationType,
    customMessage,
    badgeName,
    showCelebration,
    hideCelebration,
  };
}
