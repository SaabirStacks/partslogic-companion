import { View } from 'react-native';

import { Icon } from './icon';
import type { IconName } from './icons';
import { Plate } from './plate';
import { SignText } from './sign-text';

const JOBS: IconName[] = ['lookup', 'receive', 'count', 'move'];

// The sign at the way in, like a site entrance board: the name on a black band over the jobs' blue signs.
// It names the app; the jobs themselves are on the board after signing in, so screen readers skip the row.
export function EntranceBoard() {
  return (
    <Plate heavy className="overflow-hidden">
      <View accessible accessibilityRole="header" accessibilityLabel="PartsLogic" className="bg-plain px-4 py-3">
        <SignText size="display" weight="heavy" ink="text-on-plain" className="tracking-[3px]">
          PartsLogic
        </SignText>
      </View>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden className="flex-row gap-2 p-3">
        {JOBS.map((icon) => (
          <Plate key={icon} tone="mandatory" className="aspect-square flex-1 items-center justify-center">
            <Icon name={icon} size={30} colour="on-mandatory" />
          </Plate>
        ))}
      </View>
    </Plate>
  );
}
