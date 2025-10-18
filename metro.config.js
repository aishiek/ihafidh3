// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);
// Ensure Metro treats SQLite DB files as assets so `require()` works
config.resolver = config.resolver || {};
config.resolver.assetExts = Array.from(new Set([
  ...(config.resolver.assetExts || []),
  'db',
  'sqlite',
  'sqlite3',
]));

// If building production bundle, preserve names for clearer crash logs
if (process.env.METRO_ENV === 'production') {
  config.transformer.minifierConfig = {
    keep_classnames: true,
    keep_fnames: true,
    mangle: { safari10: true },
    compress: { reduce_funcs: false },
  };
  // Helpful for Hermes debugging
  config.serializer = config.serializer || {};
  config.serializer.getModulesRunBeforeMainModule = () => [require.resolve('./polyfills.js')].filter(Boolean);
}

module.exports = config;
