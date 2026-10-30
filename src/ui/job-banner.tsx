import { View } from 'react-native';

import type { WorkflowFamily } from '@/workflows/catalogue';

import { cx } from './cx';
import { familyColours } from './family';
import { Txt } from './text';

// What a job is locked to, as a strip above the camera: whose delivery it is, the bin being counted. Big
// enough to check at arm's length before every scan; the detail line says the rest (receipt number,
// delivery note, where the stock goes). The line under it takes the job's family colour, so you can tell at
// a glance which kind of job you're in.
export function JobBanner({
  title,
  detail,
  size = 'title',
  family,
}: {
  title: string;
  detail?: string | null;
  size?: 'title' | 'headline';
  family?: WorkflowFamily;
}) {
  return (
    <View
      accessible
      accessibilityRole="header"
      className={cx('gap-0.5 bg-surface px-4 py-2.5', family ? cx('border-b-[3px]', familyColours(family).border) : 'border-b border-edge')}>
      <Txt variant={size} numberOfLines={1} className="font-extrabold">
        {title}
      </Txt>
      {detail ? (
        <Txt variant="caption" numberOfLines={1}>
          {detail}
        </Txt>
      ) : null}
    </View>
  );
}
