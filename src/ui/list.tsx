import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { cx } from './cx';
import { Icon } from './icon';

// An inset group of rows on paper, with an optional heading above it.
export function ListGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      {title ? (
        <Text accessibilityRole="header" className="px-4 text-sm font-semibold text-quiet-ink">
          {title}
        </Text>
      ) : null}
      <View className="overflow-hidden rounded-xl bg-paper">{children}</View>
    </View>
  );
}

type ListRowProps = {
  label: string;
  value?: string;
  detail?: string | null;
  onPress?: () => void;
  last?: boolean;
  // Figures line up in columns (quantities, prices, codes).
  tabular?: boolean;
  trailing?: ReactNode;
};

export function ListRow({ label, value, detail, onPress, last, tabular, trailing }: ListRowProps) {
  const content = (
    <>
      <View className="shrink gap-0.5">
        <Text className="text-base text-ink">{label}</Text>
        {detail ? (
          <Text numberOfLines={2} className="text-sm text-quiet-ink">
            {detail}
          </Text>
        ) : null}
      </View>
      <View className="shrink flex-row items-center gap-1.5">
        {value ? (
          <Text numberOfLines={1} className={cx('shrink text-right text-base text-quiet-ink', tabular && 'tabular-nums')}>
            {value}
          </Text>
        ) : null}
        {trailing}
        {onPress ? <Icon name="forward" size={12} colour="quiet-ink" /> : null}
      </View>
    </>
  );
  const frame = cx(
    'min-h-12 flex-row items-center justify-between gap-4 px-4 py-3',
    !last && 'border-b border-hairline',
  );
  const description = [label, value, detail].filter(Boolean).join(', ');
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={description} onPress={onPress} className={cx(frame, 'active:bg-canvas')}>
      {content}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={description} className={frame}>
      {content}
    </View>
  );
}
