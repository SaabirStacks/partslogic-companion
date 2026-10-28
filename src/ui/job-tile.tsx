import { View } from 'react-native';

import { Icon } from './icon';
import type { IconName } from './icons';
import { PressableCard } from './surface';
import { Txt } from './text';

// A job on the board: a white tile with its symbol in a small grey square, its name, and at most one line
// about it ("24 in Unbinned"). Two to a row; the board lays them out.
export function JobTile({ label, icon, detail, onPress }: { label: string; icon: IconName; detail?: string | null; onPress: () => void }) {
  return (
    <PressableCard
      haptic
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      onPress={onPress}
      className="min-h-28 justify-between gap-4 p-3">
      <View className="h-10 w-10 items-center justify-center rounded-[10px] bg-rule">
        <Icon name={icon} size={22} colour="action-ink" />
      </View>
      <View className="gap-0.5">
        <Txt variant="label" numberOfLines={2} className="font-bold">
          {label}
        </Txt>
        {detail ? (
          <Txt variant="caption" numberOfLines={1} className="text-[13px] font-semibold">
            {detail}
          </Txt>
        ) : null}
      </View>
    </PressableCard>
  );
}
