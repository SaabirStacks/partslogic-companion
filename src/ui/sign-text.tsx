import { Text, type TextProps } from 'react-native';

import { cx } from './cx';

// The type scale. Sign text is Barlow Condensed in capitals, for anything read at arm's length: codes,
// quantities, job names, buttons. Small detail stays in the system face (Detail below), so it follows the
// platform's reading size like any other app.
export type SignSize = 'hero' | 'display' | 'headline' | 'title' | 'label' | 'tag';

const SIZE: Record<SignSize, string> = {
  hero: 'text-[56px] leading-[58px]',
  display: 'text-[40px] leading-[42px]',
  headline: 'text-[32px] leading-[34px]',
  title: 'text-[26px] leading-[28px]',
  label: 'text-[20px] leading-[22px] tracking-[0.4px]',
  tag: 'text-[15px] leading-[18px] tracking-[0.6px]',
};

const WEIGHT = { semi: 'font-sign', bold: 'font-sign-bold', heavy: 'font-sign-heavy' } as const;

// The biggest sizes are already sized for arm's length, so they grow less with the reading size than the
// rest; the layout stays whole at the largest settings.
const MAX_SCALE: Record<SignSize, number> = { hero: 1.3, display: 1.4, headline: 1.5, title: 1.6, label: 1.8, tag: 2 };

// Colour is its own prop (a text-* class, ink by default) rather than part of className, because two
// colour classes on one element don't reliably resolve in the order they're written.
export function SignText({
  size = 'label',
  weight = 'bold',
  ink = 'text-ink',
  className,
  ...props
}: TextProps & { size?: SignSize; weight?: keyof typeof WEIGHT; ink?: string; className?: string }) {
  return (
    <Text
      maxFontSizeMultiplier={MAX_SCALE[size]}
      className={cx('uppercase tabular-nums', SIZE[size], WEIGHT[weight], ink, className)}
      {...props}
    />
  );
}

// One line of small print in the system face: a description, a time, a reason something was refused.
export function Detail({ ink = 'text-quiet-ink', className, ...props }: TextProps & { ink?: string; className?: string }) {
  return <Text className={cx('text-[15px] leading-5', ink, className)} {...props} />;
}
