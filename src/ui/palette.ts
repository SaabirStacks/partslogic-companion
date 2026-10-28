import { vars } from 'nativewind';

// The trade-counter palette, the one place colours are defined. Calm by default: white surfaces on the
// counter's light grey, near-black text. Colour has exactly two jobs:
//   action (PartsLogic blue)  the button you're meant to press, and nothing else
//   ok / warn / stop          a state: done or sent, check it or waiting, stopped or refused
// Each state has a soft fill for chips, an ink for its words on white or on the soft fill, and a strong
// fill (with on-*) for the rare moment that must be seen across the room, such as a done screen.
// Values are "r g b". NativeWind classes (bg-surface, text-ok-ink...) read them through the CSS variables
// themeVars() sets at the root; native props (headers, icons) read them through colour().
const light = {
  ground: '242 244 246',
  surface: '255 255 255',
  edge: '216 221 226',
  rule: '232 235 238',
  ink: '18 20 23',
  'quiet-ink': '86 93 101',
  focus: '21 72 137',
  action: '21 72 137', // #154889, the app icon's blue
  'on-action': '255 255 255',
  'action-ink': '21 72 137',
  ok: '35 127 82',
  'on-ok': '255 255 255',
  'ok-soft': '227 242 232',
  'ok-ink': '24 96 60',
  warn: '249 168 0',
  'on-warn': '18 20 23',
  'warn-soft': '255 241 204',
  'warn-ink': '117 79 0',
  stop: '193 18 28',
  'on-stop': '255 255 255',
  'stop-soft': '253 228 228',
  'stop-ink': '160 16 25',
};

export type ColourName = keyof typeof light;
export type Scheme = 'light' | 'dark';

// After dark (or in a dim aisle) the counter goes graphite: the same roles, lifted so they read on it.
const dark: Record<ColourName, string> = {
  ground: '15 17 19',
  surface: '27 30 34',
  edge: '52 57 63',
  rule: '38 42 47',
  ink: '238 240 242',
  'quiet-ink': '170 177 184',
  focus: '141 180 240',
  action: '47 109 196',
  'on-action': '255 255 255',
  'action-ink': '141 180 240',
  ok: '35 127 82',
  'on-ok': '255 255 255',
  'ok-soft': '20 52 35',
  'ok-ink': '124 216 162',
  warn: '249 168 0',
  'on-warn': '18 20 23',
  'warn-soft': '61 46 9',
  'warn-ink': '246 196 83',
  stop: '200 24 34',
  'on-stop': '255 255 255',
  'stop-soft': '64 20 22',
  'stop-ink': '255 138 132',
};

export const palette: Record<Scheme, Record<ColourName, string>> = { light, dark };

// The tones a surface, chip or button can take. "neutral" is plain white (graphite at night) with no state.
export type Tone = 'action' | 'ok' | 'warn' | 'stop' | 'neutral';

// "rgb(r, g, b)" for props that take a colour value.
export function colour(scheme: Scheme, name: ColourName): string {
  return `rgb(${palette[scheme][name].split(' ').join(', ')})`;
}

// CSS variables for NativeWind, set once at the root of the app (and again inside modals).
export function themeVars(scheme: Scheme) {
  return vars(
    Object.fromEntries(Object.entries(palette[scheme]).map(([name, value]) => [`--color-${name}`, value])),
  );
}
