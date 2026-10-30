import { View } from 'react-native';

import type { WorkflowFamily } from '@/workflows/catalogue';

import { Badge, type BadgeState } from './badge';
import { cx } from './cx';
import { familyColours } from './family';
import { Icon } from './icon';
import type { IconName } from './icons';
import { PressableCard } from './surface';
import { Txt } from './text';

// A job on the board: its symbol on a square in its family's colour, its name, and a badge in the top right
// corner when there's something about it ("Open", "2 waiting"), lined up with the symbol's top. Every tile is
// the same size whether it has one or not. Two to a row; the board lays them out.
export function JobTile({
  label,
  icon,
  family,
  badge,
  onPress,
}: {
  label: string;
  icon: IconName;
  family: WorkflowFamily;
  badge?: BadgeState | null;
  onPress: () => void;
}) {
  const colours = familyColours(family);
  return (
    <PressableCard
      haptic
      accessibilityLabel={badge ? `${label}, ${badge.spoken ?? badge.label}` : label}
      onPress={onPress}
      className="min-h-28 justify-between gap-4 p-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className={cx('h-11 w-11 items-center justify-center rounded-[12px]', colours.bg)}>
          <Icon name={icon} size={24} colour={colours.ink} />
        </View>
        {badge ? <Badge {...badge} /> : null}
      </View>
      <Txt variant="label" numberOfLines={2} className="font-bold">
        {label}
      </Txt>
    </PressableCard>
  );
}
