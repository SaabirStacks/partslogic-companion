// Colours come from CSS variables that src/ui/palette.ts sets at the root, so light and dark mode switch
// in one place. The names are the safety-sign roles described there.
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

const NAMES = [
  'ground',
  'plate',
  'plate-edge',
  'rule',
  'ink',
  'quiet-ink',
  'focus',
  ...['mandatory', 'safe', 'warning', 'stop', 'plain'].flatMap((hue) => [hue, `${hue}-edge`, `on-${hue}`]),
  ...['mandatory', 'safe', 'warning', 'stop'].map((hue) => `${hue}-ink`),
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
      // Barlow Condensed, the road-sign face, for codes, quantities, job names and buttons. Each weight is
      // its own family (loaded in src/app/_layout.tsx), so never pair these with font-bold.
      fontFamily: {
        sign: ['BarlowCondensed_600SemiBold'],
        'sign-bold': ['BarlowCondensed_700Bold'],
        'sign-heavy': ['BarlowCondensed_800ExtraBold'],
      },
      borderRadius: {
        plate: '6px',
      },
    },
  },
  plugins: [],
};
