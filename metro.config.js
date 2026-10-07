const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// inlineRem 16 keeps Tailwind sizes in points (text-base is 16, p-4 is 16), matching the platforms' scales.
module.exports = withNativeWind(config, { input: './src/global.css', inlineRem: 16 });
