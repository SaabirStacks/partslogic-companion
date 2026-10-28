import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './icon';
import type { IconName } from './icons';
import type { Tone } from './palette';
import { ON_TONE, PressableCard, TEXT_ON } from './surface';
import { Txt } from './text';
import { useColour } from './theme';

type Secondary = { label: string; icon: IconName; onPress: () => void };

// The one main action of a job screen, pinned in the thumb zone: a full-width button such as
// "Finish · 24 units". An optional square button beside it holds the job's second action (Undo, Discard).
export function ActionBar({
  label,
  onPress,
  tone = 'action',
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
  const ink = disabled ? 'text-quiet-ink' : TEXT_ON[tone];
  return (
    <View style={{ paddingBottom: Math.max(insets.bottom, 12) }} className="flex-row gap-2 border-t border-edge bg-ground px-4 pt-3">
      {secondary ? (
        <PressableCard accessibilityLabel={secondary.label} onPress={secondary.onPress} className="h-14 w-14 items-center justify-center">
          <Icon name={secondary.icon} size={22} />
        </PressableCard>
      ) : null}
      <PressableCard
        tone={tone}
        haptic
        accessibilityLabel={label}
        accessibilityState={{ disabled, busy }}
        disabled={disabled}
        onPress={busy ? undefined : onPress}
        className="h-14 flex-1 flex-row items-center justify-center gap-2 px-4">
        {busy ? (
          <ActivityIndicator color={colourOf(ON_TONE[tone])} />
        ) : icon ? (
          <View>
            <Icon name={icon} size={20} colour={disabled ? 'quiet-ink' : ON_TONE[tone]} />
          </View>
        ) : null}
        <Txt variant="label" numberOfLines={1} ink={ink} className="font-bold">
          {label}
        </Txt>
      </PressableCard>
    </View>
  );
}
