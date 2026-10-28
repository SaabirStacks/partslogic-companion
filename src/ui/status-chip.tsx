import { View } from 'react-native';

import { cx } from './cx';
import { Icon } from './icon';
import type { IconName } from './icons';
import type { Tone } from './palette';
import { SOFT, TONE_INK, TONE_TEXT } from './surface';
import { Txt } from './text';

export type ChipState = { tone: Tone; icon: IconName; label: string };

// A state in words, with its symbol, on its soft colour: "In stock", "Reorder", "3 waiting". Never colour
// alone. Large is for a scan result, read at arm's length.
export function StatusChip({ tone, icon, label, large = false }: ChipState & { large?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      className={cx('flex-row items-center self-start rounded-chip', SOFT[tone], large ? 'gap-2 px-3 py-1.5' : 'gap-1.5 px-2.5 py-1')}>
      <Icon name={icon} size={large ? 20 : 16} colour={tone === 'neutral' ? 'quiet-ink' : TONE_INK[tone]} />
      <Txt variant={large ? 'label' : 'caption'} ink={tone === 'neutral' ? 'text-quiet-ink' : TONE_TEXT[tone]} className="font-semibold" numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}
