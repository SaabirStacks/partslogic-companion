import { View } from 'react-native';

import { cx } from '@/ui/cx';

const CORNER = 'absolute h-7 w-7 border-warning';

// Yellow corner marks in the middle of the camera: where to hold the barcode.
export function Reticle() {
  return (
    <View pointerEvents="none" className="absolute inset-x-10 top-1/2 h-28 -translate-y-14">
      <View className={cx(CORNER, 'left-0 top-0 rounded-tl-plate border-l-4 border-t-4')} />
      <View className={cx(CORNER, 'right-0 top-0 rounded-tr-plate border-r-4 border-t-4')} />
      <View className={cx(CORNER, 'bottom-0 left-0 rounded-bl-plate border-b-4 border-l-4')} />
      <View className={cx(CORNER, 'bottom-0 right-0 rounded-br-plate border-b-4 border-r-4')} />
    </View>
  );
}
