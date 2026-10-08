import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Icon } from './icon';
import type { IconName } from './icons';
import type { ColourName } from './palette';

// The answer to a scan, shown in place under the camera rather than over it.
export function Panel({
  icon,
  iconColour = 'quiet-ink',
  title,
  body,
  children,
}: {
  icon: IconName;
  iconColour?: ColourName;
  title: string;
  body?: string | null;
  children?: ReactNode;
}) {
  return (
    <View accessibilityLiveRegion="polite" className="gap-3 rounded-plate border-2 border-plate-edge bg-plate p-4">
      <View className="flex-row items-start gap-3">
        <Icon name={icon} size={22} colour={iconColour} />
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold text-ink">{title}</Text>
          {body ? <Text className="text-sm leading-5 text-quiet-ink">{body}</Text> : null}
        </View>
      </View>
      {children ? <View className="gap-2">{children}</View> : null}
    </View>
  );
}
