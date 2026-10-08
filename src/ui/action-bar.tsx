import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './icon';
import type { IconName } from './icons';
import type { Tone } from './palette';
import { ON_TONE, PressablePlate, TEXT_ON } from './plate';
import { SignText } from './sign-text';
import { useColour } from './theme';

type Secondary = { label: string; icon: IconName; onPress: () => void };

// The one main action of a job screen, pinned in the thumb zone: a full-width plate such as
// "Finish · 24 units". An optional square plate beside it holds the job's second action (Undo, Discard).
export function ActionBar({
  label,
  onPress,
  tone = 'mandatory',
  icon,
  busy = false,
  disabled = false,
  secondary,
}: {
  label: string;
  onPress: () => void;
  tone?: Tone;
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
  secondary?: Secondary;
}) {
  const insets = useSafeAreaInsets();
  const colourOf = useColour();
  return (
    <View
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      className="flex-row gap-2 border-t-2 border-rule bg-ground px-3 pt-3">
      {secondary ? (
        <PressablePlate
          accessibilityLabel={secondary.label}
          onPress={secondary.onPress}
          className="h-16 w-16 items-center justify-center">
          <Icon name={secondary.icon} size={26} />
        </PressablePlate>
      ) : null}
      <PressablePlate
        tone={tone}
        heavy
        haptic
        accessibilityLabel={label}
        accessibilityState={{ disabled, busy }}
        disabled={disabled}
        onPress={busy ? undefined : onPress}
        className="h-16 flex-1 flex-row items-center justify-center gap-3 px-4">
        {busy ? (
          <ActivityIndicator color={colourOf(ON_TONE[tone])} />
        ) : icon ? (
          <View>
            <Icon name={icon} size={24} colour={ON_TONE[tone]} />
          </View>
        ) : null}
        <SignText size="title" weight="heavy" numberOfLines={1} ink={TEXT_ON[tone]}>
          {label}
        </SignText>
      </PressablePlate>
    </View>
  );
}
