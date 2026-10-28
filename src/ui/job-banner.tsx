import { View } from 'react-native';

import { Txt } from './text';

// What a job is locked to, as a strip above the camera: whose delivery it is, the bin being counted. Big
// enough to check at arm's length before every scan; the detail line says the rest (receipt number,
// delivery note, where the stock goes).
export function JobBanner({ title, detail, size = 'title' }: { title: string; detail?: string | null; size?: 'title' | 'headline' }) {
  return (
    <View accessible accessibilityRole="header" className="gap-0.5 border-b border-edge bg-surface px-4 py-2.5">
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
