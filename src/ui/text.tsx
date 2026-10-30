import { Text, type TextProps } from 'react-native';

import { cx } from './cx';

// The type scale, all in the phone's own face (San Francisco, Roboto). The few values read at arm's
// length (quantities, part numbers, bin codes) are display and headline, 28 pt and up; everything read
// in the hand is 15–17. Colour is its own prop (a text-* class) because two colour classes on one
// element don't reliably resolve in the order they're written. numbers turns on tabular figures, for
// quantities that line up; leave it off for codes like A-01 or GR-0042 (it spaces out their hyphens).
export type TextVariant = 'display' | 'headline' | 'title' | 'body' | 'label' | 'caption' | 'section';

const VARIANT: Record<TextVariant, string> = {
  display: 'text-[40px] leading-[44px] font-extrabold tracking-[-0.5px]',
  headline: 'text-[28px] leading-[32px] font-bold tracking-[-0.3px]',
  title: 'text-[20px] leading-[25px] font-bold',
  body: 'text-[17px] leading-[23px]',
  label: 'text-[17px] leading-[22px] font-semibold',
  caption: 'text-[15px] leading-[20px]',
  section: 'text-[14px] leading-[19px] font-bold uppercase tracking-[0.6px]',
};

const DEFAULT_INK: Record<TextVariant, string> = {
  display: 'text-ink',
  headline: 'text-ink',
  title: 'text-ink',
  body: 'text-ink',
  label: 'text-ink',
  caption: 'text-quiet-ink',
  section: 'text-label',
};

// The biggest sizes are already made for arm's length, so they grow less with the reading size than the
// rest; the layout stays whole at the largest settings.
const MAX_SCALE: Record<TextVariant, number> = { display: 1.35, headline: 1.5, title: 1.8, body: 2, label: 2, caption: 2, section: 1.7 };

export function Txt({
  variant = 'body',
  ink,
  numbers = false,
  className,
  ...props
}: TextProps & { variant?: TextVariant; ink?: string; numbers?: boolean; className?: string }) {
  return (
    <Text
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      className={cx(VARIANT[variant], ink ?? DEFAULT_INK[variant], numbers && 'tabular-nums', className)}
      {...props}
    />
  );
}
