// Colours come from CSS variables that src/ui/palette.ts sets at the root, so light and dark mode switch
// in one place.
// Names follow PartsLogic's DESIGN.md: tint is Stock Blue (the action colour), reorder is the amber that
// only ever means "needs reordering", out is the red for out of stock and errors.
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        tint: token('tint'),
        'on-tint': token('on-tint'),
        focus: token('focus'),
        mist: token('mist'),
        'mist-ink': token('mist-ink'),
        ink: token('ink'),
        'quiet-ink': token('quiet-ink'),
        paper: token('paper'),
        canvas: token('canvas'),
        hairline: token('hairline'),
        reorder: token('reorder'),
        'reorder-ink': token('reorder-ink'),
        out: token('out'),
      },
    },
  },
  plugins: [],
};
