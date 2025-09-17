// Production-focused Metro config with safer minification settings.
// Use by setting METRO_ENV=production or by copying into metro.config.js before build.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = (function(){
  const config = getDefaultConfig(__dirname);
  // Keep function/class names for better native stack traces
  config.transformer.minifierConfig = {
    keep_classnames: true,
    keep_fnames: true,
    mangle: { safari10: true },
    compress: { reduce_funcs: false }
  };
  return config;
})();
