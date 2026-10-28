import { useCallback, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icon';
import { PressableCard } from '@/ui/surface';
import { Txt } from '@/ui/text';

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

// White corner marks across the middle of the camera: where to hold the barcode. While the job waits on
// the scan just made, the camera dims, the marks fade and say Paused, or offer Scan next when the job
// resumes from the camera (Look up). The camera is always dark, so these are white in light and dark mode.
export function Reticle({ frame, paused = false, onResume }: { frame: Box | null; paused?: boolean; onResume?: () => void }) {
  if (!frame) return null;
  const edge = paused ? 'border-white/60' : 'border-white';
  return (
    <>
      {paused ? <View pointerEvents="none" className="absolute inset-0 bg-black/55" /> : null}
      <View pointerEvents="none" style={{ position: 'absolute', left: frame.x, top: frame.y, width: frame.width, height: frame.height }}>
        <View className={cx(CORNER, edge, 'left-0 top-0 rounded-tl-[10px] border-l-4 border-t-4')} />
        <View className={cx(CORNER, edge, 'right-0 top-0 rounded-tr-[10px] border-r-4 border-t-4')} />
        <View className={cx(CORNER, edge, 'bottom-0 left-0 rounded-bl-[10px] border-b-4 border-l-4')} />
        <View className={cx(CORNER, edge, 'bottom-0 right-0 rounded-br-[10px] border-b-4 border-r-4')} />
        {paused && !onResume ? (
          <View className="flex-1 flex-row items-center justify-center gap-2">
            <Txt variant="section" ink="text-white" className="tracking-[1.5px]">
              Paused
            </Txt>
          </View>
        ) : null}
      </View>
      {paused && onResume ? (
        <View className="absolute items-center justify-center" style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}>
          <PressableCard haptic accessibilityLabel="Scan next" onPress={onResume} className="min-h-14 flex-row items-center gap-2 px-5">
            <Icon name="barcode" size={20} colour="action-ink" />
            <Txt variant="label" className="font-bold">
              Scan next
            </Txt>
          </PressableCard>
        </View>
      ) : null}
    </>
  );
}
