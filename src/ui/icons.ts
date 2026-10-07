import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

// Every icon the app uses: an SF Symbol on iOS and a Material symbol on Android, so each platform
// draws its own native glyph. Tabs and screens both read from here.
export const ICONS = {
  lookup: { ios: 'magnifyingglass', android: 'search' },
  receive: { ios: 'shippingbox', android: 'inventory_2' },
  count: { ios: 'tray.2', android: 'shelves' },
  outbox: { ios: 'tray.and.arrow.up', android: 'outbox' },
  account: { ios: 'person.crop.circle', android: 'account_circle' },
  barcode: { ios: 'barcode.viewfinder', android: 'barcode_scanner' },
  location: { ios: 'mappin.and.ellipse', android: 'location_on' },
  chevron: { ios: 'chevron.down', android: 'expand_more' },
  forward: { ios: 'chevron.right', android: 'chevron_right' },
  check: { ios: 'checkmark', android: 'check' },
  sent: { ios: 'checkmark.circle', android: 'check_circle' },
  offline: { ios: 'wifi.slash', android: 'wifi_off' },
  warning: { ios: 'exclamationmark.triangle', android: 'warning' },
} satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;
