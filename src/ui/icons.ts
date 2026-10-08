import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

// Every pictogram the app uses: a filled SF Symbol on iOS and a Material symbol on Android (and on the web
// review gallery, which draws Android's), so each platform draws its own native glyph.
const symbol = (ios: SFSymbol, android: AndroidSymbol) => ({ ios, android, web: android });

export const ICONS = {
  // Jobs
  lookup: symbol('magnifyingglass', 'search'),
  receive: symbol('shippingbox.fill', 'package_2'),
  count: symbol('tray.2.fill', 'shelves'),
  move: symbol('arrow.left.arrow.right', 'swap_horiz'),
  add: symbol('plus.square.fill', 'add_box'),
  sync: symbol('arrow.triangle.2.circlepath', 'sync'),
  account: symbol('person.crop.circle.fill', 'account_circle'),
  // Scanning
  barcode: symbol('barcode.viewfinder', 'barcode_scanner'),
  keyboard: symbol('keyboard.fill', 'keyboard'),
  bin: symbol('tray.fill', 'inventory_2'),
  location: symbol('mappin.and.ellipse', 'location_on'),
  // States
  sent: symbol('checkmark.circle.fill', 'check_circle'),
  waiting: symbol('clock.fill', 'schedule'),
  warning: symbol('exclamationmark.triangle.fill', 'warning'),
  stop: symbol('xmark.octagon.fill', 'dangerous'),
  offline: symbol('wifi.slash', 'wifi_off'),
  // Controls
  check: symbol('checkmark', 'check'),
  close: symbol('xmark', 'close'),
  minus: symbol('minus', 'remove'),
  plus: symbol('plus', 'add'),
  undo: symbol('arrow.uturn.backward', 'undo'),
  retry: symbol('arrow.clockwise', 'refresh'),
  chevron: symbol('chevron.down', 'expand_more'),
  forward: symbol('chevron.right', 'chevron_right'),
  back: symbol('chevron.left', 'arrow_back'),
  signOut: symbol('rectangle.portrait.and.arrow.right', 'logout'),
} satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;
