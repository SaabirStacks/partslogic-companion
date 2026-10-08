import { palette } from '../palette';

// Tailwind's colour classes and the palette must name the same colours, or a class silently draws nothing.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- tailwind.config.js is CommonJS
const tailwind = require('../../../tailwind.config.js') as { theme: { extend: { colors: Record<string, string> } } };

describe('palette', () => {
  it('defines the same colours in light and dark', () => {
    expect(Object.keys(palette.dark).sort()).toEqual(Object.keys(palette.light).sort());
  });

  it('gives Tailwind a class for every colour, and nothing else', () => {
    expect(Object.keys(tailwind.theme.extend.colors).sort()).toEqual(Object.keys(palette.light).sort());
  });
});
