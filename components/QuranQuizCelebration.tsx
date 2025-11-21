import CelebrationModal from './CelebrationModal';
import React from 'react';

/**
 * @deprecated Use CelebrationModal with type="quiz" instead
 * This component is kept for backward compatibility
 */
export default function QuranQuizCelebration({ visible, onComplete }: { visible: boolean; onComplete?: () => void }) {
  return <CelebrationModal visible={visible} type="quiz" onComplete={onComplete} />;
}
