import { vars } from 'nativewind';

// The safety-sign palette, the one place colours are defined. Every colour that isn't a neutral is a sign
// staff already obey (ISO 7010 hues, tuned for contrast on a phone):
//   mandatory (blue)  do this: jobs, the main action
//   safe (green)      done or sent
//   warning (yellow)  check it: unknown code, reorder, waiting to send
//   stop (red)        stop: out of stock, refused, error
//   plain (black)     a sign with no state, such as Add part
// Each hue has four roles: the plate fill, its darker edge, the text on the plate (on-*), and the hue as
// text or an icon on a neutral plate (*-ink, darker in light mode and lighter in dark so it stays readable).
// Values are "r g b". NativeWind classes (bg-mandatory, text-on-warning...) read them through the CSS
// variables themeVars() sets at the root; native props (headers, icons) read them through colour().
const light = {
  ground: '226 227 223', // concrete
  plate: '250 250 247',
  'plate-edge': '184 186 180',
  rule: '204 206 200',
  ink: '17 17 17',
  'quiet-ink': '74 76 72',
  focus: '21 72 137',
  mandatory: '21 72 137', // #154889
  'mandatory-edge': '12 47 92',
  'on-mandatory': '255 255 255',
  'mandatory-ink': '21 72 137',
  safe: '35 127 82', // #237F52
  'safe-edge': '23 92 58',
  'on-safe': '255 255 255',
  'safe-ink': '26 102 64',
  warning: '249 168 0', // #F9A800
  'warning-edge': '196 130 0',
  'on-warning': '17 17 17',
  'warning-ink': '133 86 0',
  stop: '193 18 28', // #C1121C
  'stop-edge': '140 12 20',
  'on-stop': '255 255 255',
  'stop-ink': '168 14 23',
  plain: '28 29 27',
  'plain-edge': '0 0 0',
  'on-plain': '255 255 255',
};

export type ColourName = keyof typeof light;
export type Scheme = 'light' | 'dark';

// Night: the ground goes near-black and the signs keep their colours (a sign doesn't change after dark).
// Edges turn lighter, like a reflective rim, so plates keep their outline against the dark. The black sign
// becomes charcoal for the same reason.
const dark: Record<ColourName, string> = {
  ground: '18 19 17',
  plate: '32 33 30',
  'plate-edge': '92 95 87',
  rule: '52 54 49',
  ink: '242 242 238',
  'quiet-ink': '182 184 176',
  focus: '141 180 240',
  mandatory: '28 86 160',
  'mandatory-edge': '86 140 214',
  'on-mandatory': '255 255 255',
  'mandatory-ink': '141 180 240',
  safe: '35 127 82',
  'safe-edge': '74 170 118',
  'on-safe': '255 255 255',
  'safe-ink': '110 204 152',
  warning: '249 168 0',
  'warning-edge': '255 204 92',
  'on-warning': '17 17 17',
  'warning-ink': '250 196 82',
  stop: '200 24 34',
  'stop-edge': '240 96 100',
  'on-stop': '255 255 255',
  'stop-ink': '255 128 120',
  plain: '44 46 42',
  'plain-edge': '120 123 114',
  'on-plain': '255 255 255',
};

export const palette: Record<Scheme, Record<ColourName, string>> = { light, dark };

// The sign tones a plate can take. "surface" is a white (or night) plate with no state.
export type Tone = 'mandatory' | 'safe' | 'warning' | 'stop' | 'plain' | 'surface';

// "rgb(r, g, b)" for props that take a colour value.
export function colour(scheme: Scheme, name: ColourName): string {
  return `rgb(${palette[scheme][name].split(' ').join(', ')})`;
}

// CSS variables for NativeWind, set once at the root of the app.
export function themeVars(scheme: Scheme) {
  return vars(
    Object.fromEntries(Object.entries(palette[scheme]).map(([name, value]) => [`--color-${name}`, value])),
  );
}
