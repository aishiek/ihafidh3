// Global JS error & promise rejection handlers for production builds.
// Ensures errors during early TurboModule init do not silently kill the app without logs.

/* eslint-disable no-console */
export function initGlobalErrorHandlers() {
  // Avoid re-installing
  if ((global as any).__GLOBAL_ERROR_HANDLERS_SET__) return;
  (global as any).__GLOBAL_ERROR_HANDLERS_SET__ = true;

  const ErrorUtilsAny: any = (global as any).ErrorUtils;
  const previousHandler = ErrorUtilsAny?.getGlobalHandler?.();

  if (ErrorUtilsAny?.setGlobalHandler) {
    ErrorUtilsAny.setGlobalHandler((error: any, isFatal?: boolean) => {
      try {
        console.log('[global-error]', isFatal ? '(FATAL)' : '(non-fatal)', error?.stack || error?.message || String(error));
      } catch {}
      if (previousHandler) {
        try { previousHandler(error, isFatal); } catch {}
      }
    });
  }

  // Unhandled promise rejections (Hermes + RN 0.81 still emit on global)
  const record = new Set<string>();
  function logOnce(tag: string, msg: string) {
    if (record.has(tag + msg)) return;
    record.add(tag + msg);
    console.log(tag, msg);
  }

  function rejectionListener(event: any) {
    const reason = event?.reason || event;
    const msg = reason?.stack || reason?.message || String(reason);
    logOnce('[unhandled-rejection]', msg);
  }

  // Different runtimes: addEventListener vs process.on vs globalThis.onunhandledrejection
  if (typeof addEventListener === 'function') {
    // @ts-ignore
    addEventListener('unhandledrejection', rejectionListener);
  } else if (typeof (global as any).onunhandledrejection === 'undefined') {
    try {
      const proc: any = (global as any).process;
      proc?.on?.('unhandledRejection', (reason: any) => rejectionListener({ reason }));
    } catch {}
  }
  console.log('[init] Global error & rejection handlers installed');
}
