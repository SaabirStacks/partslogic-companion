import { View } from 'react-native';

import { Icon } from '@/ui/icon';
import { PressablePlate } from '@/ui/plate';
import { Detail, SignText } from '@/ui/sign-text';

// One part in a list (recent scans, search matches, alternatives): brand and number as a sign, the
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
    <PressablePlate
      accessibilityLabel={[`${brand} ${number}`, description, value].filter(Boolean).join(', ')}
      onPress={onPress}
      className="min-h-16 flex-row items-center gap-3 px-3 py-2">
      <View className="flex-1">
        <SignText size="label" weight="heavy" numberOfLines={1}>
          {`${brand} ${number}`}
        </SignText>
        {description ? <Detail numberOfLines={1}>{description}</Detail> : null}
      </View>
      {value ? (
        <SignText size="label" weight="heavy" numberOfLines={1}>
          {value}
        </SignText>
      ) : null}
      <Icon name="forward" size={16} />
    </PressablePlate>
  );
}
