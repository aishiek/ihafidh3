import { useEffect } from 'react';
import MemorizationCache from '@/utils/MemorizationCache';
import { getAllMemorizedVerseIds, getAllRevisedVerseIds } from '@/database/QuranDatabase';
import { requestNotificationPermissions, scheduleRevisionReminders } from '@/utils/notificationUtils';
import { isDailyRevisionGoalMet, isWeeklyRevisionGoalMet } from '@/utils/revisionGoalUtils';

export default function App() {
  useEffect(() => {
    (async () => {
      const memorizedIds = await getAllMemorizedVerseIds();
      const revisedIds = await getAllRevisedVerseIds();
      MemorizationCache.warmUp(memorizedIds, revisedIds);
      // Request notification permissions and schedule reminders
      await requestNotificationPermissions();
      await scheduleRevisionReminders({
        dailyIncomplete: !isDailyRevisionGoalMet(),
        weeklyIncomplete: !isWeeklyRevisionGoalMet(),
      });
    })();
  }, []);
}