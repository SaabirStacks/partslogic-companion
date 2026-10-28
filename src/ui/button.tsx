import { ActivityIndicator, View } from 'react-native';

import { cx } from './cx';
import { Icon } from './icon';
import type { IconName } from './icons';
import type { Tone } from './palette';
import { ON_TONE, PressableCard, TEXT_ON } from './surface';
import { Txt } from './text';
import { useColour } from './theme';

type Variant = 'primary' | 'secondary' | 'destructive';

// primary is the blue button you're meant to press; secondary a white one with a hairline edge;
// destructive the red one, kept for actions that throw work away.
const TONE: Record<Variant, Tone> = { primary: 'action', secondary: 'neutral', destructive: 'stop' };

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
  // 56 tall by default (gloves); compact is 48, for buttons inside a row or a card.
  compact?: boolean;
};

export function Button({ label, onPress, variant = 'primary', icon, busy = false, disabled = false, compact = false }: ButtonProps) {
  const colourOf = useColour();
  const tone = TONE[variant];
  // Busy keeps its full colour (it's working, not unavailable) but ignores presses. Disabled turns grey
  // with quiet words, so it still reads.
  return (
    <PressableCard
      tone={tone}
      haptic={variant === 'primary'}
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={busy ? undefined : onPress}
      className={cx('flex-row items-center justify-center gap-2 px-4', compact ? 'min-h-12' : 'min-h-14')}>
      {busy ? (
        <ActivityIndicator color={colourOf(ON_TONE[tone])} />
      ) : icon ? (
        <View>
          <Icon name={icon} size={18} colour={disabled ? 'quiet-ink' : ON_TONE[tone]} />
        </View>
      ) : null}
      <Txt variant="label" ink={disabled ? 'text-quiet-ink' : TEXT_ON[tone]} className="font-bold">
        {label}
      </Txt>
    </PressableCard>
  );
}
