import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Icon } from './icon';
import type { IconName } from './icons';

// The centre of a screen with nothing to show yet: what this place is for and what to do next.
export function EmptyState({
  icon,
  title,
  body,
  children,
}: {
  icon: IconName;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-16">
      <Icon name={icon} size={36} colour="quiet-ink" />
      <Text accessibilityRole="header" className="text-center text-xl font-semibold text-ink">
        {title}
      </Text>
      <Text className="text-center text-base leading-6 text-quiet-ink">{body}</Text>
      {children ? <View className="mt-4 gap-3 self-stretch">{children}</View> : null}
    </View>
  );
}
