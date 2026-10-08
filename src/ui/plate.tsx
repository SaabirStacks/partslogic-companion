import type { ReactNode } from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';

import { cx } from './cx';
import type { ColourName, Tone } from './palette';

// A sign plate: flat colour, a darker edge, 6 px corners, no shadow. Everything with a state is a plate in
// that state's tone (see palette.ts); "surface" is the plain white plate for content with no state.
const FILL: Record<Tone, string> = {
  mandatory: 'bg-mandatory border-mandatory-edge',
  safe: 'bg-safe border-safe-edge',
  warning: 'bg-warning border-warning-edge',
  stop: 'bg-stop border-stop-edge',
  plain: 'bg-plain border-plain-edge',
  surface: 'bg-plate border-plate-edge',
};

// The colour of text and pictograms on a plate of each tone.
export const ON_TONE: Record<Tone, ColourName> = {
  mandatory: 'on-mandatory',
  safe: 'on-safe',
  warning: 'on-warning',
  stop: 'on-stop',
  plain: 'on-plain',
  surface: 'ink',
};

export const TEXT_ON: Record<Tone, string> = {
  mandatory: 'text-on-mandatory',
  safe: 'text-on-safe',
  warning: 'text-on-warning',
  stop: 'text-on-stop',
  plain: 'text-on-plain',
  surface: 'text-ink',
};

// A tone's hue as text on a neutral plate: a red OUT beside a quantity, a green SENT in a list.
export const TONE_INK: Record<Tone, ColourName> = {
  mandatory: 'mandatory-ink',
  safe: 'safe-ink',
  warning: 'warning-ink',
  stop: 'stop-ink',
  plain: 'ink',
  surface: 'ink',
};

export const TEXT_INK: Record<Tone, string> = {
  mandatory: 'text-mandatory-ink',
  safe: 'text-safe-ink',
  warning: 'text-warning-ink',
  stop: 'text-stop-ink',
  plain: 'text-ink',
  surface: 'text-ink',
};

type PlateStyle = { tone?: Tone; heavy?: boolean; className?: string };

// A 2 px edge; heavy (3 px) for the big signs: job tiles and the action plate.
export function plateClass({ tone = 'surface', heavy = false, className }: PlateStyle) {
  return cx('rounded-plate', heavy ? 'border-[3px]' : 'border-2', FILL[tone], className);
}

export function Plate({ tone, heavy, className, ...props }: ViewProps & PlateStyle) {
  return <View className={plateClass({ tone, heavy, className })} {...props} />;
}

// A plate you can press. It dims while held, and a disabled plate fades back so it reads as unavailable.
export function PressablePlate({
  tone,
  heavy,
  className,
  disabled,
  children,
  ...props
}: Omit<PressableProps, 'children'> & PlateStyle & { children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      className={plateClass({ tone, heavy, className: cx('active:opacity-75', disabled && 'opacity-40', className) })}
      {...props}>
      {children}
    </Pressable>
  );
}
