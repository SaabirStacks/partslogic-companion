import { ActivityIndicator, Pressable, Text } from 'react-native';

import { cx } from './cx';
import { useColour } from './theme';

type Variant = 'primary' | 'secondary' | 'destructive';

const FRAME: Record<Variant, string> = {
  primary: 'bg-tint',
  secondary: 'border border-hairline bg-paper',
  destructive: 'bg-paper',
};

const LABEL: Record<Variant, string> = {
  primary: 'text-on-tint',
  secondary: 'text-ink',
  destructive: 'text-out',
};

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  busy?: boolean;
  disabled?: boolean;
};

// 48 tall, full width of its container: thumb-sized on both platforms.
export function Button({ label, onPress, variant = 'primary', busy = false, disabled = false }: ButtonProps) {
  const colourOf = useColour();
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      className={cx(
        'h-12 flex-row items-center justify-center gap-2 rounded-xl px-5 active:opacity-80',
        FRAME[variant],
        inactive && 'opacity-50',
      )}>
      {busy ? <ActivityIndicator color={colourOf(variant === 'primary' ? 'on-tint' : 'ink')} /> : null}
      <Text className={cx('text-base font-semibold', LABEL[variant])}>{label}</Text>
    </Pressable>
  );
}
