import { SymbolView } from 'expo-symbols';

import { ICONS, type IconName } from './icons';
import type { ColourName } from './palette';
import { useColour } from './theme';

export function Icon({ name, size = 22, colour = 'ink' }: { name: IconName; size?: number; colour?: ColourName }) {
  const colourOf = useColour();
  return <SymbolView name={ICONS[name]} size={size} tintColor={colourOf(colour)} />;
}
