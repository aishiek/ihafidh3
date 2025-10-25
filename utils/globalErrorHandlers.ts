// Global JS error & promise rejection handlers.
// Ensures errors during early TurboModule init do not silently kill the app without logs
// and surfaces a native Alert during development so errors can be inspected when
// running in the simulator / dev client (addresses run:ios silent exits).

/* eslint-disable no-console */
import { Alert, Platform } from 'react-native';

export function initGlobalErrorHandlers() {
  // Avoid re-installing
  if ((global as any).__GLOBAL_ERROR_HANDLERS_SET__) return;
  (global as any).__GLOBAL_ERROR_HANDLERS_SET__ = true;

  const ErrorUtilsAny: any = (global as any).ErrorUtils;
  const previousHandler = ErrorUtilsAny?.getGlobalHandler?.();

  // Simple de-duplication for alerts/logs
  const seen = new Set<string>();
  function logOnce(tag: string, message: string) {
    const key = tag + '|' + message;
    if (seen.has(key)) return;
    seen.add(key);
    try { console.log(tag, message); } catch {}
  }

  function showAlertOnce(title: string, message: string) {
    // Avoid showing alerts on web or when Alert isn't available
    if (Platform.OS === 'web') return;
    const key = title + '|' + message;
    if (seen.has(key)) return;
    seen.add(key);
    try {
      // Truncate overly long messages to avoid native alert overflow
      const short = message.length > 1200 ? message.slice(0, 1200) + '\n...[truncated]' : message;
      Alert.alert(title || 'Error', short, [{ text: 'Dismiss' }], { cancelable: true });
    } catch (e) {
      try { console.log('[alert-failed]', e); } catch {}
    }
  }

  if (ErrorUtilsAny?.setGlobalHandler) {
    ErrorUtilsAny.setGlobalHandler((error: any, isFatal?: boolean) => {
      const msg = error?.stack || error?.message || String(error);
      try {
        logOnce('[global-error]', (isFatal ? '(FATAL) ' : '(non-fatal) ') + msg);
        showAlertOnce('Unexpected error', msg);
      } catch {}
      if (previousHandler) {
        try { previousHandler(error, isFatal); } catch (e) { try { console.log('[prevHandler] failed', e); } catch {} }
      }
    });
  }

  // Unhandled promise rejections (Hermes + RN 0.81 still emit on global)
  function rejectionListener(event: any) {
    const reason = event?.reason || event;
    const msg = reason?.stack || reason?.message || String(reason);
    try {
      logOnce('[unhandled-rejection]', msg);
      showAlertOnce('Unhandled promise rejection', msg);
    } catch {}
  }

  // Different runtimes: addEventListener vs process.on vs globalThis.onunhandledrejection
  try {
    if (typeof addEventListener === 'function') {
      // @ts-ignore
      addEventListener('unhandledrejection', rejectionListener);
    } else if (typeof (global as any).onunhandledrejection === 'undefined') {
      const proc: any = (global as any).process;
      proc?.on?.('unhandledRejection', (reason: any) => rejectionListener({ reason }));
    }
  } catch (e) {
    try { console.log('[global-error] registration failed', e); } catch {}
  }

  console.log('[init] Global error & rejection handlers installed');
}
