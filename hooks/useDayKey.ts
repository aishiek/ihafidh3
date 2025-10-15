import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

function formatDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * useDayKey returns a local-date key (YYYY-MM-DD) and updates when the calendar day changes.
 * It listens to AppState changes (becoming active) and does a lightweight periodic check.
 */
export function useDayKey() {
  const [dayKey, setDayKey] = useState<string>(formatDate(new Date()));

  useEffect(() => {
    const updateIfChanged = () => {
      const next = formatDate(new Date());
      setDayKey((prev) => (prev !== next ? next : prev));
    };

    // Check immediately on mount
    updateIfChanged();

    // Update when app returns to foreground
    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') updateIfChanged();
    };
    const sub = AppState.addEventListener('change', onAppStateChange);

    // Also poll occasionally to catch midnight while app stays active
    const interval = setInterval(updateIfChanged, 60 * 1000);

    return () => {
      sub?.remove?.();
      clearInterval(interval);
    };
  }, []);

  return dayKey;
}
