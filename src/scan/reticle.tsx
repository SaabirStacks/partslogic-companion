import { useCallback, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icon';
import { PressablePlate } from '@/ui/plate';
import { SignText } from '@/ui/sign-text';

import { aimFrame, type Box } from './aim';

// The camera view's size and the aiming frame drawn in it, measured once the view is laid out.
export function useAimFrame() {
  const [view, setView] = useState<{ width: number; height: number } | null>(null);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setView((current) => (current && current.width === width && current.height === height ? current : { width, height }));
  }, []);
  return { onLayout, view, frame: view ? aimFrame(view) : null };
}

const CORNER = 'absolute h-7 w-7';

// Yellow corner marks across the middle of the camera: where to hold the barcode. While the job waits on
// the scan just made, the camera dims, the marks turn white and say Paused, or offer Scan next when the
// job resumes from the camera (Look up).
export function Reticle({ frame, paused = false, onResume }: { frame: Box | null; paused?: boolean; onResume?: () => void }) {
  if (!frame) return null;
  const edge = paused ? 'border-on-plain' : 'border-warning';
  return (
    <>
      {paused ? <View pointerEvents="none" className="absolute inset-0 bg-black/55" /> : null}
      <View pointerEvents="none" style={{ position: 'absolute', left: frame.x, top: frame.y, width: frame.width, height: frame.height }}>
        <View className={cx(CORNER, edge, 'left-0 top-0 rounded-tl-plate border-l-4 border-t-4')} />
        <View className={cx(CORNER, edge, 'right-0 top-0 rounded-tr-plate border-r-4 border-t-4')} />
        <View className={cx(CORNER, edge, 'bottom-0 left-0 rounded-bl-plate border-b-4 border-l-4')} />
        <View className={cx(CORNER, edge, 'bottom-0 right-0 rounded-br-plate border-b-4 border-r-4')} />
        {paused && !onResume ? (
          <View className="flex-1 flex-row items-center justify-center gap-2">
            <Icon name="waiting" size={20} colour="on-plain" />
            <SignText size="label" weight="heavy" ink="text-on-plain">
              Paused
            </SignText>
          </View>
        ) : null}
      </View>
      {paused && onResume ? (
        <View className="absolute items-center justify-center" style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}>
          <PressablePlate haptic accessibilityLabel="Scan next" onPress={onResume} className="min-h-14 flex-row items-center gap-2 px-5">
            <Icon name="barcode" size={22} />
            <SignText size="label" weight="heavy">
              Scan next
            </SignText>
          </PressablePlate>
        </View>
      ) : null}
    </>
  );
}
