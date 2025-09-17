// Optional polyfills & early diagnostics inserted before main module in production Metro config.
(function(){
  if (global.__IH_PROD_DIAGNOSTICS_INIT__) return;
  global.__IH_PROD_DIAGNOSTICS_INIT__ = true;
  try {
    const start = Date.now();
    console.log('[diag] polyfills.js loaded at', start);
    // Early promise rejection visibility
    if (typeof addEventListener === 'function') {
      addEventListener('unhandledrejection', ev => {
        console.log('[diag early unhandledrejection]', ev?.reason?.message || ev?.reason || ev);
      });
    }
  } catch (e) {
    console.log('[diag] polyfills init error', e);
  }
})();
