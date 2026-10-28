import { View } from 'react-native';

import { Icon } from './icon';
import { Txt } from './text';

// The app's name at the way in: the blue mark and PartsLogic beside it, with what the app is for.
export function Wordmark() {
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="PartsLogic" className="flex-row items-center gap-3">
      <View className="h-12 w-12 items-center justify-center rounded-[14px] bg-action">
        <Icon name="barcode" size={24} colour="on-action" />
      </View>
      <View className="gap-0.5">
        <Txt variant="title" className="font-extrabold tracking-[0.3px]">
          PartsLogic
        </Txt>
        <Txt variant="caption">Stock on the floor, in step with the office</Txt>
      </View>
    </View>
  );
}
