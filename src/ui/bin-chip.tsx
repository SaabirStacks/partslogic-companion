import { View } from 'react-native';

import { Plate, PressablePlate, TEXT_ON } from './plate';
import { SignText } from './sign-text';

// A bin as a small label plate: its code and, when it holds stock, how many (A-01 ×4). Selected bins turn
// blue, like any choice that is about to be acted on.
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
  const tone = selected ? 'mandatory' : 'surface';
  const label = qty === undefined ? code : `${code}, ${qty}`;
  const face = (
    <View className="flex-row items-baseline gap-1.5">
      <SignText size="label" weight="heavy" ink={TEXT_ON[tone]}>
        {code}
      </SignText>
      {qty !== undefined ? (
        <SignText size="label" weight="semi" ink={TEXT_ON[tone]}>
          ×{qty}
        </SignText>
      ) : null}
    </View>
  );
  const frame = 'min-h-12 justify-center px-3';
  return onPress ? (
    <PressablePlate tone={tone} accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} className={frame}>
      {face}
    </PressablePlate>
  ) : (
    <Plate tone={tone} accessible accessibilityLabel={label} className={frame}>
      {face}
    </Plate>
  );
}
