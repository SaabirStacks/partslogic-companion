import { ActivityIndicator, View } from 'react-native';

import { cx } from './cx';
import { Icon } from './icon';
import type { IconName } from './icons';
import type { ColourName } from './palette';
import { ON_TONE, PressableCard, TEXT_ON, type Fill } from './surface';
import { Txt } from './text';
import { useColour } from './theme';

type Variant = 'primary' | 'tinted' | 'secondary' | 'destructive';

// primary is the blue button you're meant to press; tinted a second action that does something (Move,
// Search again, Pause), soft blue with blue words; secondary a white one with a hairline edge, for leaving
// or letting go (Cancel, Skip, Done); destructive the red one, kept for actions that throw work away.
const FILL_OF: Record<Variant, Fill> = { primary: 'action', tinted: 'tint', secondary: 'neutral', destructive: 'stop' };
const INK: Record<Variant, { text: string; icon: ColourName }> = {
  primary: { text: TEXT_ON.action, icon: ON_TONE.action },
  tinted: { text: 'text-action-ink', icon: 'action-ink' },
  secondary: { text: TEXT_ON.neutral, icon: ON_TONE.neutral },
  destructive: { text: TEXT_ON.stop, icon: ON_TONE.stop },
};

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
  const ink = INK[variant];
  // Busy keeps its full colour (it's working, not unavailable) but ignores presses. Disabled turns grey
  // with quiet words, so it still reads.
  return (
    <PressableCard
      tone={FILL_OF[variant]}
      haptic={variant === 'primary' || variant === 'tinted'}
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={busy ? undefined : onPress}
      className={cx('flex-row items-center justify-center gap-2 px-4', compact ? 'min-h-12' : 'min-h-14')}>
      {busy ? (
        <ActivityIndicator color={colourOf(ink.icon)} />
      ) : icon ? (
        <View>
          <Icon name={icon} size={18} colour={disabled ? 'quiet-ink' : ink.icon} />
        </View>
      ) : null}
      <Txt variant="label" ink={disabled ? 'text-quiet-ink' : ink.text} className="font-bold">
        {label}
      </Txt>
    </PressableCard>
  );
}
