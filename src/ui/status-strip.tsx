import { View } from 'react-native';

import { Icon } from './icon';
import type { IconName } from './icons';
import type { Tone } from './palette';
import { ON_TONE, Plate, TEXT_ON } from './plate';
import { Detail } from './sign-text';

// One line about a state on a plate of that state's colour: offline, refused, saved copy. The icon and the
// words carry it as well as the colour.
export function StatusStrip({ tone, icon, text }: { tone: Tone; icon: IconName; text: string }) {
  return (
    <Plate tone={tone} accessibilityRole="alert" className="flex-row items-center gap-2 px-3 py-2.5">
      <View>
        <Icon name={icon} size={20} colour={ON_TONE[tone]} />
      </View>
      <Detail ink={TEXT_ON[tone]} className="flex-1 text-base font-semibold">
        {text}
      </Detail>
    </Plate>
  );
}
