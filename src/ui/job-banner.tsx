import { View } from 'react-native';

import { SignText } from './sign-text';

// What a job is locked to, as a strip above the camera: the delivery's receipt number, the bin being
// counted. Big enough to check at arm's length before every scan.
export function JobBanner({ title, detail, size = 'title' }: { title: string; detail?: string | null; size?: 'title' | 'display' }) {
  return (
    <View accessible accessibilityRole="header" className="flex-row items-baseline gap-3 border-b-2 border-rule bg-plate px-4 py-2">
      <SignText size={size} weight="heavy" numberOfLines={1} className="flex-1">
        {title}
      </SignText>
      {detail ? (
        <SignText size="tag" ink="text-quiet-ink" numberOfLines={1}>
          {detail}
        </SignText>
      ) : null}
    </View>
  );
}
