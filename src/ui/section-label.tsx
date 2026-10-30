import { View } from 'react-native';

import type { WorkflowFamily } from '@/workflows/catalogue';

import { cx } from './cx';
import { familyColours } from './family';
import { Txt } from './text';

// The heading over a group of cards: Recent, 12 matches, Bins. A family's heading on the board carries a
// small square in the family's colour.
export function SectionLabel({ children, family }: { children: string; family?: WorkflowFamily }) {
  if (!family) {
    return (
      <Txt accessibilityRole="header" variant="section" className="mt-2 px-1">
        {children}
      </Txt>
    );
  }
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={children} className="mt-2 flex-row items-center gap-2 px-1">
      <View className={cx('h-2.5 w-2.5 rounded-[3px]', familyColours(family).dot)} />
      <Txt variant="section">{children}</Txt>
    </View>
  );
}
