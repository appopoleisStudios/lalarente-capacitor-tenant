module.exports = function(api) {
  api.cache(true);

  // nativewind/babel is a preset (returns { plugins: [...] }) but was listed
  // as a plugin, causing Babel validation error: ".plugins is not a valid
  // Plugin property". We resolve it here and flatten its plugins into the
  // main plugins array, deduplicating against react-native-reanimated/plugin
  // which the nativewind preset already includes.
  let nativewindPlugins = [];
  try {
    const nativewindPreset = require('nativewind/babel');
    const resolved = typeof nativewindPreset === 'function'
      ? nativewindPreset()
      : nativewindPreset;
    if (resolved && resolved.plugins) {
      nativewindPlugins = resolved.plugins
        .filter(p => {
          // react-native-reanimated/plugin already includes worklets;
          // including both causes Babel "Duplicate plugin/preset" error.
          const pluginName = Array.isArray(p) ? p[0] : p;
          return typeof pluginName !== 'string' ||
            !pluginName.includes('react-native-worklets');
        })
        .map(p => (Array.isArray(p) ? p : [p, {}]));
    }
  } catch (e) {
    // Fallback if nativewind or deps not installed (CI, fresh clone)
    console.warn('nativewind/babel not found, skipping:', e.message);
  }

  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }]],
    plugins: [
      ...nativewindPlugins,
      'react-native-reanimated/plugin',
    ],
  };
};
