import { View } from 'react-native';

import { cx } from './cx';
import { Icon } from './icon';
import type { IconName } from './icons';
import { ON_TONE, PressablePlate, TEXT_ON } from './plate';
import { SignText } from './sign-text';

// A job on the board, drawn as a sign: a white pictogram and a two-word name on a blue plate (black for
// Add part, which has no state of its own). Square in the grid; wide for the one job that leads the board.
export function JobTile({
  label,
  icon,
  onPress,
  tone = 'mandatory',
  wide = false,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  tone?: 'mandatory' | 'plain';
  wide?: boolean;
}) {
  return (
    <PressablePlate
      tone={tone}
      heavy
      accessibilityLabel={label}
      onPress={onPress}
      className={cx(
        'p-4',
        wide ? 'min-h-[112px] flex-row items-center gap-4' : 'aspect-square flex-1 justify-between',
      )}>
      <View>
        <Icon name={icon} size={wide ? 48 : 40} colour={ON_TONE[tone]} />
      </View>
      <SignText size={wide ? 'headline' : 'title'} weight="heavy" numberOfLines={2} ink={TEXT_ON[tone]} className={cx(wide && 'flex-1')}>
        {label}
      </SignText>
    </PressablePlate>
  );
}
