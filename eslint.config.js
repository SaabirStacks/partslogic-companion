// https://docs.expo.dev/guides/using-eslint/ (Expo's own template, as `expo lint` writes it)
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // src/vendor is PartsLogic's code, copied unchanged; it is linted in PartsLogic.
    ignores: ['dist/*', 'src/vendor/*'],
  },
]);
