import type { Ref } from 'react';
import { TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';

import { Txt } from './text';
import { useColour } from './theme';

// A labelled text box, 56 tall, on a white surface. The label sits above it, never a placeholder that
// disappears while typing.
export function Field({ label, ref, ...props }: TextInputProps & { label: string; ref?: Ref<TextInputInstance> }) {
  const colourOf = useColour();
  return (
    <View className="gap-1.5">
      <Txt variant="caption" ink="text-label" className="px-0.5 font-semibold">
        {label}
      </Txt>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colourOf('quiet-ink')}
        className="h-14 rounded-card border-[1.5px] border-edge bg-surface px-4 text-[17px] text-ink focus:border-focus"
        {...props}
      />
    </View>
  );
}
