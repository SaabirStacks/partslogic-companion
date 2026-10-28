import type { ReactNode } from 'react';
import { View } from 'react-native';

import { cx } from './cx';
import { Icon } from './icon';
import type { IconName } from './icons';
import type { Tone } from './palette';
import { SOFT, TONE_INK } from './surface';
import { Txt } from './text';

// A screen that stands in for a job until something is done: its symbol on a soft square in the state's
// colour (grey with a blue symbol when it's just a next step), a title, at most one short line, and the
// actions that move on.
export function Notice({
  icon,
  tone = 'action',
  title,
  line,
  children,
}: {
  icon: IconName;
  tone?: Tone;
  title: string;
  line?: string | null;
  children?: ReactNode;
}) {
  const step = tone === 'action' || tone === 'neutral';
  return (
    <View className="flex-1 justify-center gap-6 px-6 py-12">
      <View accessible className="items-center gap-4">
        <View className={cx('h-20 w-20 items-center justify-center rounded-[20px]', step ? 'bg-rule' : SOFT[tone])}>
          <Icon name={icon} size={40} colour={step ? 'action-ink' : TONE_INK[tone]} />
        </View>
        <Txt accessibilityRole="header" variant="headline" className="text-center font-extrabold">
          {title}
        </Txt>
        {line ? (
          <Txt variant="body" ink="text-quiet-ink" className="text-center">
            {line}
          </Txt>
        ) : null}
      </View>
      {children ? <View className="gap-3">{children}</View> : null}
    </View>
  );
}
