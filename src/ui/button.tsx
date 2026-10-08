import { ActivityIndicator, View } from 'react-native';

import { cx } from './cx';
import { Icon } from './icon';
import type { IconName } from './icons';
import type { Tone } from './palette';
import { ON_TONE, PressablePlate, TEXT_ON } from './plate';
import { SignText } from './sign-text';
import { useColour } from './theme';

type Variant = 'primary' | 'secondary' | 'destructive';

// primary is the blue "do this" sign; secondary a plain white plate; destructive the red stop sign, kept
// for actions that throw work away.
const TONE: Record<Variant, Tone> = { primary: 'mandatory', secondary: 'surface', destructive: 'stop' };

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
  // 56 tall by default (gloves); compact is 48, for buttons inside a row or a plate.
  compact?: boolean;
};

export function Button({ label, onPress, variant = 'primary', icon, busy = false, disabled = false, compact = false }: ButtonProps) {
  const colourOf = useColour();
  const tone = TONE[variant];
  // Busy keeps its full colour (it's working, not unavailable) but ignores presses.
  return (
    <PressablePlate
      tone={tone}
      haptic={variant === 'primary'}
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={busy ? undefined : onPress}
      className={cx('flex-row items-center justify-center gap-2 px-5', compact ? 'min-h-12' : 'min-h-14')}>
      {busy ? (
        <ActivityIndicator color={colourOf(ON_TONE[tone])} />
      ) : icon ? (
        <View>
          <Icon name={icon} size={20} colour={ON_TONE[tone]} />
        </View>
      ) : null}
      <SignText size="label" ink={TEXT_ON[tone]}>
        {label}
      </SignText>
    </PressablePlate>
  );
}
