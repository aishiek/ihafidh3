module.exports = function(api) {
  // Simple cache configuration
  api.cache(true);
  
  // Set default value for EXPO_ROUTER_IMPORT_MODE
  process.env.EXPO_ROUTER_IMPORT_MODE = process.env.EXPO_ROUTER_IMPORT_MODE || 'sync';

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', {
        root: ['.'],
        alias: {
          '@': '.',
        },
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      }],
      'react-native-reanimated/plugin',
      // Remove console.* calls in production builds to keep logs clean and avoid leaking
      // potentially sensitive information. We use the widely used transform-remove-console
      // during production builds only.
      ...(process.env.NODE_ENV === 'production' ? ['transform-remove-console'] : []),
    ],
  };
};
