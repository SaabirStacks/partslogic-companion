import { View } from 'react-native';

import { Badge, type BadgeState } from './badge';
import { Icon } from './icon';
import type { IconName } from './icons';
import { PressableCard } from './surface';
import { Txt } from './text';

// A job on the board: a tile with its symbol in a small grey square, its name, and a badge in the top right
// corner when there's something about it ("Open", "2 waiting"). Every tile is the same size whether it has
// one or not. Two to a row; the board lays them out.
export function JobTile({ label, icon, badge, onPress }: { label: string; icon: IconName; badge?: BadgeState | null; onPress: () => void }) {
  return (
    <PressableCard
      haptic
      accessibilityLabel={badge ? `${label}, ${badge.spoken ?? badge.label}` : label}
      onPress={onPress}
      className="min-h-28 justify-between gap-4 p-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="h-10 w-10 items-center justify-center rounded-[10px] bg-rule">
          <Icon name={icon} size={22} colour="action-ink" />
        </View>
        {badge ? <Badge {...badge} /> : null}
      </View>
      <Txt variant="label" numberOfLines={2} className="font-bold">
        {label}
      </Txt>
    </PressableCard>
  );
}
