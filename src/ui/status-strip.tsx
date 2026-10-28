import { View } from 'react-native';

import { Icon } from './icon';
import type { IconName } from './icons';
import type { Tone } from './palette';
import { SOFT, TONE_INK, TONE_TEXT } from './surface';
import { Txt } from './text';
import { cx } from './cx';

// One line about a state on that state's soft colour: offline, refused, saved copy. The symbol and the
// words carry it as well as the colour.
export function StatusStrip({ tone, icon, text }: { tone: Tone; icon: IconName; text: string }) {
  const neutral = tone === 'neutral';
  return (
    <View accessibilityRole="alert" className={cx('flex-row items-center gap-2 rounded-card px-3 py-2.5', SOFT[tone])}>
      <View>
        <Icon name={icon} size={18} colour={neutral ? 'quiet-ink' : TONE_INK[tone]} />
      </View>
      <Txt variant="caption" ink={neutral ? 'text-ink' : TONE_TEXT[tone]} className="flex-1 font-semibold">
        {text}
      </Txt>
    </View>
  );
}
