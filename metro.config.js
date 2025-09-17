// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

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
