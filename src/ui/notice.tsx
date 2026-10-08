import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Icon } from './icon';
import type { IconName } from './icons';
import type { Tone } from './palette';
import { ON_TONE, Plate } from './plate';
import { Detail, SignText } from './sign-text';

// A screen that stands in for a job until something is done: a square sign with its pictogram, a title,
// at most one short line, and the actions that move on.
export function Notice({
  icon,
  tone = 'mandatory',
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
  return (
    <View className="flex-1 justify-center gap-6 px-6 py-12">
      <View accessible className="items-center gap-4">
        <Plate tone={tone} heavy className="h-24 w-24 items-center justify-center">
          <Icon name={icon} size={52} colour={ON_TONE[tone]} />
        </Plate>
        <SignText accessibilityRole="header" size="headline" weight="heavy" className="text-center">
          {title}
        </SignText>
        {line ? (
          <Detail ink="text-ink" className="text-center text-base leading-6">
            {line}
          </Detail>
        ) : null}
      </View>
      {children ? <View className="gap-3">{children}</View> : null}
    </View>
  );
}
