import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import { Txt } from '@/ui/text';
import { useColour } from '@/ui/theme';
import { signaturePath, type SignatureStroke } from '@/vendor/partslogic/shared/sales/delivery';

import { SIGN_PAD_LABEL } from './words';

// The customer signs here with a finger (react-native-svg, approved 26 November 2026). Strokes are in the pad's own
// points; onDraw hands the parent how to add the latest point, with the pad's size, and the hook scales them to the
// 1000 by 400 pad PartsLogic keeps (padStrokes). The callbacks run on the JS thread: a signature is a few hundred
// points, and the path is redrawn as each arrives.
export function SignaturePad({
  strokes,
  onDraw,
  onDrawing,
  hint,
  height = 200,
}: {
  strokes: SignatureStroke[];
  onDraw: (change: (now: SignatureStroke[]) => SignatureStroke[], size: { width: number; height: number }) => void;
  // While a finger is on the pad, so the screen around it doesn't scroll.
  onDrawing?: (drawing: boolean) => void;
  // "Sign here", shown on the empty pad.
  hint: string;
  height?: number;
}) {
  const colourOf = useColour();
  const [size, setSize] = useState({ width: 0, height });
  // Each point builds on the strokes as they are, not on what the screen last drew.
  const add = (x: number, y: number, start: boolean) => {
    const point: [number, number] = [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
    onDraw((now) => (start || now.length === 0 ? [...now, [point]] : [...now.slice(0, -1), [...now[now.length - 1]!, point]]), size);
  };
  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    maxPointers: 1,
    onBegin: (event) => {
      onDrawing?.(true);
      add(event.x, event.y, true);
    },
    onUpdate: (event) => add(event.x, event.y, false),
    onFinalize: () => onDrawing?.(false),
  });
  const empty = strokes.length === 0;
  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={empty ? `${SIGN_PAD_LABEL}, ${hint}` : `${SIGN_PAD_LABEL}, signed`}
        onLayout={(event: LayoutChangeEvent) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
        style={{ height }}
        className="overflow-hidden rounded-card border-[1.5px] border-edge bg-surface">
        {empty ? (
          <View pointerEvents="none" className="absolute inset-x-0 bottom-6 items-center">
            <Txt variant="caption" ink="text-quiet-ink">
              {hint}
            </Txt>
          </View>
        ) : null}
        {/* The line a signature sits on, as on paper. */}
        <View pointerEvents="none" className="absolute inset-x-6 bottom-12 h-px bg-edge" />
        {size.width > 0 ? (
          <Svg width={size.width} height={size.height} pointerEvents="none">
            <Path d={signaturePath(strokes)} stroke={colourOf('ink')} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
        ) : null}
      </View>
    </GestureDetector>
  );
}
