import { View } from 'react-native';

import { Icon } from '@/ui/icon';
import { PressableCard } from '@/ui/surface';
import { Txt } from '@/ui/text';

// One part in a list (recent scans, search matches, alternatives): brand and number in bold, the
// description under it, and an optional figure on the right such as how many are on hand.
export function PartRow({
  brand,
  number,
  description,
  value,
  onPress,
}: {
  brand: string;
  number: string;
  description: string | null;
  value?: string;
  onPress: () => void;
}) {
  return (
    <PressableCard
      accessibilityLabel={[`${brand} ${number}`, description, value].filter(Boolean).join(', ')}
      onPress={onPress}
      className="min-h-16 flex-row items-center gap-3 px-3 py-2">
      <View className="flex-1">
        <Txt variant="label" numberOfLines={1}>
          {`${brand} ${number}`}
        </Txt>
        {description ? <Txt variant="caption" numberOfLines={1}>{description}</Txt> : null}
      </View>
      {value ? (
        <Txt variant="label" numberOfLines={1}>
          {value}
        </Txt>
      ) : null}
      <Icon name="forward" size={16} />
    </PressableCard>
  );
}
