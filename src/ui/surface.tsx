import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, View, type GestureResponderEvent, type PressableProps, type ViewProps } from 'react-native';

import { cx } from './cx';
import type { ColourName, Tone } from './palette';

// The till's one material: a white surface with 12 px corners and a hairline edge on the counter grey.
// Filled tones are for buttons and the rare state that must be seen across the room; everything else
// is neutral, and a state shows as a chip on it (status-chip.tsx).
const FILL: Record<Tone, string> = {
  action: 'bg-action border-action',
  ok: 'bg-ok border-ok',
  warn: 'bg-warn border-warn',
  stop: 'bg-stop border-stop',
  neutral: 'bg-surface border-edge',
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

type SurfaceStyle = { tone?: Tone; className?: string };

export function surfaceClass({ tone = 'neutral', className }: SurfaceStyle) {
  return cx('rounded-card border', FILL[tone], className);
}

export function Card({ tone, className, ...props }: ViewProps & SurfaceStyle) {
  return <View className={surfaceClass({ tone, className })} {...props} />;
}

// A surface you can press: it darkens and sinks a little while held (NativeWind's active: state on a
// plain Pressable; an animated wrapper loses these styles on phones). Main actions add a light haptic.
// Disabled keeps its words readable: a grey surface with quiet text, never a faded colour.
export function PressableCard({
  tone = 'neutral',
  className,
  disabled,
  haptic = false,
  children,
  onPress,
  ...props
}: Omit<PressableProps, 'children' | 'style'> & SurfaceStyle & { haptic?: boolean; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={(event: GestureResponderEvent) => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(event);
      }}
      className={cx(
        'rounded-card border active:scale-[0.98] active:opacity-85',
        disabled ? 'border-edge bg-rule' : FILL[tone],
        className,
      )}
      {...props}>
      {children}
    </Pressable>
  );
}
