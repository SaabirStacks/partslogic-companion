// NativeWind v4 setup. babel-preset-expo already adds the worklets plugin when it is installed,
// so it is not listed here (adding it twice breaks Reanimated).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
