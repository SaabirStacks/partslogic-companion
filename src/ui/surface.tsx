import type { ReactNode } from 'react';
import { Pressable, View, type GestureResponderEvent, type PressableProps, type ViewProps } from 'react-native';

import { feel } from '@/feel/feel';
import type { TouchMoment } from '@/feel/moments';

import { cx } from './cx';
import { depthStyle, type Depth } from './depth';
import type { ColourName, Tone } from './palette';
import { useScheme } from './theme';

// The till's one material: a white surface with 12 px corners and a hairline edge on the counter grey,
// lifted a little off it (depth.ts). Filled tones are for buttons and the rare state that must be seen
// across the room; everything else is neutral, and a state shows as a chip on it (status-chip.tsx). tint is
// a second button's soft blue: clearly pressable, never as loud as the one solid blue button.
export type Fill = Tone | 'tint';

const FILL: Record<Fill, string> = {
  action: 'bg-action border-action',
  ok: 'bg-ok border-ok',
  warn: 'bg-warn border-warn',
  stop: 'bg-stop border-stop',
  neutral: 'bg-surface border-edge',
  tint: 'bg-action-soft border-action-soft',
};

// Text and pictograms on a filled surface of each tone.
export const TEXT_ON: Record<Tone, string> = {
  action: 'text-on-action',
  ok: 'text-on-ok',
  warn: 'text-on-warn',
  stop: 'text-on-stop',
  neutral: 'text-ink',
};

export const ON_TONE: Record<Tone, ColourName> = {
  action: 'on-action',
  ok: 'on-ok',
  warn: 'on-warn',
  stop: 'on-stop',
  neutral: 'ink',
};

// A tone as words on white: the red of an out-of-stock count, the green of "sent".
export const TONE_TEXT: Record<Tone, string> = {
  action: 'text-action-ink',
  ok: 'text-ok-ink',
  warn: 'text-warn-ink',
  stop: 'text-stop-ink',
  neutral: 'text-ink',
};

export const TONE_INK: Record<Tone, ColourName> = {
  action: 'action-ink',
  ok: 'ok-ink',
  warn: 'warn-ink',
  stop: 'stop-ink',
  neutral: 'ink',
};

// The soft fill behind a state's words (chips, strips).
export const SOFT: Record<Tone, string> = {
  action: 'bg-surface',
  ok: 'bg-ok-soft',
  warn: 'bg-warn-soft',
  stop: 'bg-stop-soft',
  neutral: 'bg-rule',
};

type SurfaceStyle = { tone?: Fill; className?: string };

export function surfaceClass({ tone = 'neutral', className }: SurfaceStyle) {
  return cx('rounded-card border', FILL[tone], className);
}

// A white card lifts off the counter; a filled one, or one inside another card (depth="flat"), doesn't.
function useDepth(tone: Fill, depth: Depth | undefined) {
  const scheme = useScheme();
  return depthStyle(depth ?? (tone === 'neutral' ? 'lift' : 'flat'), scheme);
}

export function Card({ tone = 'neutral', depth, className, style, ...props }: ViewProps & SurfaceStyle & { depth?: Depth }) {
  const lift = useDepth(tone, depth);
  return <View className={surfaceClass({ tone, className })} style={[lift, style]} {...props} />;
}

// A surface you can press: it darkens and sinks a little while held (NativeWind's active: state on a
// plain Pressable; an animated wrapper loses these styles on phones). haptic is the touch it makes
// (moments.ts): true for a main action's light tap, 'tick' for choosing, 'firm' for a red button.
// Disabled keeps its words readable: a grey surface with quiet text, never a faded colour.
export function PressableCard({
  tone = 'neutral',
  depth,
  className,
  disabled,
  haptic = false,
  children,
  onPress,
  ...props
}: Omit<PressableProps, 'children' | 'style'> & SurfaceStyle & { depth?: Depth; haptic?: boolean | TouchMoment; children: ReactNode }) {
  const lift = useDepth(tone, disabled ? 'flat' : depth);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={(event: GestureResponderEvent) => {
        if (haptic) feel(haptic === true ? 'press' : haptic);
        onPress?.(event);
      }}
      className={cx(
        'rounded-card border active:scale-[0.98] active:opacity-85',
        disabled ? 'border-edge bg-rule' : FILL[tone],
        className,
      )}
      style={lift}
      {...props}>
      {children}
    </Pressable>
  );
}
