import { View } from 'react-native';

import { cx } from './cx';
import { Icon } from './icon';
import type { IconName } from './icons';
import { ON_TONE, PressablePlate, TEXT_ON } from './plate';
import { SignText } from './sign-text';

// A job on the board, drawn as a sign: a white pictogram and a two-word name on a blue plate (black for
// Add part, which has no state of its own). Square in the grid; lead for the job that leads the board; bar,
// a shorter wide sign, for one left alone in its row.
export function JobTile({
  label,
  icon,
  onPress,
  tone = 'mandatory',
  shape = 'square',
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  tone?: 'mandatory' | 'plain';
  shape?: 'square' | 'lead' | 'bar';
}) {
  const wide = shape !== 'square';
  return (
    <PressablePlate
      tone={tone}
      heavy
      haptic
      accessibilityLabel={label}
      onPress={onPress}
      className={cx(
        'p-4',
        shape === 'lead' && 'min-h-[112px] flex-row items-center gap-4',
        shape === 'bar' && 'min-h-[72px] flex-row items-center gap-3',
        shape === 'square' && 'aspect-square flex-1 justify-between',
      )}>
      <View>
        <Icon name={icon} size={shape === 'lead' ? 48 : shape === 'bar' ? 32 : 40} colour={ON_TONE[tone]} />
      </View>
      <SignText size={shape === 'lead' ? 'headline' : 'title'} weight="heavy" numberOfLines={2} ink={TEXT_ON[tone]} className={cx(wide && 'flex-1')}>
        {label}
      </SignText>
    </PressablePlate>
  );
}
