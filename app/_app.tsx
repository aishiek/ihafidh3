// Legacy _app.tsx stub (fonts now loaded once in _layout.tsx)
// Kept to avoid accidental re-creation; perform optional warmup tasks here if needed.
import { getAllMemorizedVerseIds, getAllRevisedVerseIds } from '@/assets/database/QuranDatabase';
import MemorizationCache from '@/utils/MemorizationCache';
import { requestNotificationPermissions, scheduleRevisionReminders } from '@/utils/notificationUtils';
import { isDailyRevisionGoalMet, isWeeklyRevisionGoalMet } from '@/utils/revisionGoalUtils';
import { useEffect } from 'react';
import { Alert, Platform, View } from 'react-native';

// Register a global JS error handler so runtime JS errors don't kill the app without logs
function registerGlobalErrorHandlers() {
  // ErrorUtils is available in React Native runtime
  try {
    // @ts-ignore - ErrorUtils is global in RN
    const oldHandler = (global as any).ErrorUtils?.getGlobalHandler?.();
    // set new handler
    // @ts-ignore
    (global as any).ErrorUtils?.setGlobalHandler?.((error: any, isFatal?: boolean) => {
      console.error('[Global Error]', error, 'isFatal=', isFatal);
      try {
        Alert.alert('Console Error', String(error?.message || error), [{ text: 'OK' }]);
      } catch (e) {
        // ignore
      }
      if (typeof oldHandler === 'function') {
        try { oldHandler(error, isFatal); } catch (e) { /* ignore */ }
      }
    });
  } catch (e) {
    // ignore if not supported
  }

  // Handle unhandled promise rejections
  const tracking = (e: any) => {
    console.error('[Unhandled Rejection]', e);
    try { Alert.alert('Unhandled Promise Rejection', String(e?.message || e)); } catch (er) {}
  };
  // @ts-ignore
  if (Platform.OS !== 'web') {
    (global as any).onunhandledrejection = (evt: any) => {
      tracking(evt?.reason || evt);
    };
  }
}

export default function App() {
  useEffect(() => {
    registerGlobalErrorHandlers();
    (async () => {
      try {
        // Ensure mushaf/json and mushaf/images directories exist
        const { ensureMushafDirs } = await import('./initDirs');
        await ensureMushafDirs();

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
