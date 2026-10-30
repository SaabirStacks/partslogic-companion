import { Pressable, View } from 'react-native';

import { feel } from '@/feel/feel';

import { cx } from './cx';
import { Txt } from './text';

// Two or three ways to look at one list (Supplier | Manufacturer): a grey track with the chosen one
// raised in white.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View accessibilityRole="tablist" className="flex-row rounded-card bg-rule p-1">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={option.label}
            onPress={() => {
              if (!on) feel('tick');
              onChange(option.value);
            }}
            style={on ? RAISED : undefined}
            className={cx('min-h-11 flex-1 items-center justify-center rounded-[9px] px-2', on && 'bg-surface')}>
            <Txt variant="label" ink={on ? 'text-ink' : 'text-quiet-ink'} numberOfLines={1} className="font-bold">
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const RAISED = { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 } as const;
