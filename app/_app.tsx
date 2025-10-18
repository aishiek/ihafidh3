// Legacy _app.tsx stub (fonts now loaded once in _layout.tsx)
// Kept to avoid accidental re-creation; perform optional warmup tasks here if needed.
import { getAllMemorizedVerseIds, getAllRevisedVerseIds } from '@/assets/database/QuranDatabase';
import MemorizationCache from '@/utils/MemorizationCache';
import { requestNotificationPermissions, scheduleRevisionReminders } from '@/utils/notificationUtils';
import { isDailyRevisionGoalMet, isWeeklyRevisionGoalMet } from '@/utils/revisionGoalUtils';
import { useEffect } from 'react';
import { View } from 'react-native';

export default function App() {
  useEffect(() => {
    (async () => {
      try {
        const memorizedIds = await getAllMemorizedVerseIds();
        const revisedIds = await getAllRevisedVerseIds();
        MemorizationCache.warmUp(memorizedIds, revisedIds);
        
        await requestNotificationPermissions();
        await scheduleRevisionReminders({
          dailyIncomplete: !isDailyRevisionGoalMet(),
            weeklyIncomplete: !isWeeklyRevisionGoalMet(),
        });
      } catch (e) {
        console.warn('[app/_app] Warmup failed:', e);
      }
    })();
  }, []);

  // Return an empty view (router uses _layout.tsx for UI)
  return <View style={{ display: 'none' }} />;
}
