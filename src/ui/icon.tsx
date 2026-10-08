import { SymbolView } from 'expo-symbols';
import bold from 'expo-symbols/androidWeights/bold';

import { ICONS, type IconName } from './icons';
import type { ColourName } from './palette';
import { useColour } from './theme';

// A pictogram in one of the palette's colours. Bold, as on a sign; icons never carry meaning alone, so the
// caller always puts a word or a number beside them.
export function Icon({ name, size = 22, colour = 'ink' }: { name: IconName; size?: number; colour?: ColourName }) {
  const colourOf = useColour();
  return (
    <SymbolView
      name={ICONS[name]}
      size={size}
      tintColor={colourOf(colour)}
      weight={{ ios: 'bold', android: bold }}
    />
  );
}
