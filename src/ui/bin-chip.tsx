import { View } from 'react-native';

import { cx } from './cx';
import { Card, PressableCard } from './surface';
import { Txt } from './text';

// A bin as a small label: its code and, when it holds stock, how many (A-01 ×4). A chosen bin gets a dark
// outline, the same mark as any choice in a list.
export function BinChip({
  code,
  qty,
  selected = false,
  onPress,
}: {
  code: string;
  qty?: number | string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const label = qty === undefined ? code : `${code}, ${qty}`;
  const face = (
    <View className="flex-row items-baseline gap-1.5">
      <Txt variant="label" className="font-bold">
        {code}
      </Txt>
      {qty !== undefined ? (
        <Txt variant="label" numbers ink="text-quiet-ink">
          ×{qty}
        </Txt>
      ) : null}
    </View>
  );
  const frame = cx('min-h-12 justify-center px-3', selected && 'border-2 border-ink');
  return onPress ? (
    <PressableCard accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} className={frame}>
      {face}
    </PressableCard>
  ) : (
    <Card accessible accessibilityLabel={label} className={frame}>
      {face}
    </Card>
  );
}
