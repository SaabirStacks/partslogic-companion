import { vars } from 'nativewind';

// PartsLogic's colours, the one place they are defined. Values are "r g b", converted from the OKLCH
// tokens in PartsLogic's DESIGN.md (shown beside each). The web app is light only, so the dark values are
// this app's own. NativeWind classes (bg-tint, text-ink...) read them through CSS variables set by
// themeVars(); native props (tab bar, headers, icons) read them through colour().
//
// tint is Stock Blue, the action colour. reorder (amber) only ever means "needs reordering"; out (red) is
// out of stock and errors.
const light = {
  tint: '0 109 226', // oklch(0.55 0.2 255)
  'on-tint': '248 250 253', // oklch(0.985 0.005 255)
  focus: '49 134 233', // oklch(0.62 0.17 255)
  mist: '229 241 255', // oklch(0.955 0.025 255)
  'mist-ink': '0 46 102', // oklch(0.31 0.11 255)
  ink: '9 11 12', // oklch(0.148 0.004 228.8)
  'quiet-ink': '103 120 124', // oklch(0.56 0.021 213.5)
  paper: '255 255 255', // oklch(1 0 0)
  canvas: '241 243 243', // oklch(0.963 0.002 197.1)
  hairline: '227 231 232', // oklch(0.925 0.005 214.3)
  reorder: '194 111 0', // oklch(0.62 0.15 65)
  'reorder-ink': '34 18 2', // oklch(0.2 0.04 65)
  out: '231 0 11', // oklch(0.577 0.245 27.325)
};

export type ColourName = keyof typeof light;
export type Scheme = 'light' | 'dark';

const dark: Record<ColourName, string> = {
  tint: '48 140 246', // oklch(0.64 0.18 255)
  'on-tint': '248 250 253', // oklch(0.985 0.005 255)
  focus: '89 160 249', // oklch(0.7 0.15 255)
  mist: '21 39 62', // oklch(0.27 0.05 255)
  'mist-ink': '189 218 255', // oklch(0.88 0.06 255)
  ink: '243 245 247', // oklch(0.97 0.003 228.8)
  'quiet-ink': '151 168 172', // oklch(0.72 0.02 213.5)
  paper: '19 23 24', // oklch(0.2 0.006 230)
  canvas: '9 11 13', // oklch(0.15 0.004 230)
  hairline: '42 47 49', // oklch(0.3 0.008 230)
  reorder: '233 155 42', // oklch(0.75 0.15 70)
  'reorder-ink': '255 226 189', // oklch(0.93 0.06 70)
  out: '252 88 85', // oklch(0.68 0.2 25)
};

export const palette: Record<Scheme, Record<ColourName, string>> = { light, dark };

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
