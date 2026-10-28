// Colours come from CSS variables that src/ui/palette.ts sets at the root, so light and dark mode switch
// in one place. The names are the roles described there.
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

const NAMES = [
  'ground',
  'surface',
  'edge',
  'rule',
  'ink',
  'quiet-ink',
  'focus',
  'action',
  'on-action',
  'action-ink',
  ...['ok', 'warn', 'stop'].flatMap((state) => [state, `on-${state}`, `${state}-soft`, `${state}-ink`]),
];

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // Light and dark come from palette.ts through useColorScheme, never from dark: classes. 'class' only
  // stops NativeWind's web runtime throwing in the review gallery when it detects the browser's scheme.
  darkMode: 'class',
  theme: {
    extend: {
      colors: Object.fromEntries(NAMES.map((name) => [name, token(name)])),
      borderRadius: {
        card: '12px',
        chip: '8px',
      },
    },
  },
  plugins: [],
};
