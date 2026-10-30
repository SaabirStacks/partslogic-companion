import { Image } from 'expo-image';
import { View } from 'react-native';

import { Txt } from './text';

// The app's name at the way in: the app icon's PL mark (the same as the splash and the home screen) and
// PartsLogic beside it, with what the app is for.
export function Wordmark() {
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="PartsLogic" className="flex-row items-center gap-3">
      <Image source={require('../../assets/images/icon.png')} accessibilityIgnoresInvertColors style={{ width: 52, height: 52, borderRadius: 13 }} />
      <View className="gap-0.5">
        <Txt variant="title" className="font-extrabold tracking-[0.3px]">
          PartsLogic
        </Txt>
        <Txt variant="caption">Stock on the floor, in step with the office</Txt>
      </View>
    </View>
  );
}
