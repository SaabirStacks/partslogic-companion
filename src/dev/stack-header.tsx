import { View } from 'react-native';

import { Icon } from '@/ui/icon';
import { PressableCard } from '@/ui/surface';
import { Txt } from '@/ui/text';

const noop = () => {};

// Dev-only: the review gallery's stand-in for the platform's own header over a job screen.
export function StackHeader({ title, quickLookUp = true }: { title: string; quickLookUp?: boolean }) {
  return (
    <View className="h-14 flex-row items-center gap-3 bg-ground px-3">
      <Icon name="back" size={24} />
      <Txt variant="title" className="flex-1">
        {title}
      </Txt>
      {quickLookUp ? (
        <PressableCard accessibilityLabel="Look up a part" onPress={noop} className="h-11 w-11 items-center justify-center">
          <Icon name="lookup" size={22} />
        </PressableCard>
      ) : null}
    </View>
  );
}
