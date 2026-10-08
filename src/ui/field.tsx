import type { Ref } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { plateClass } from './plate';
import { SignText } from './sign-text';
import { useColour } from './theme';

// A labelled text box on a white plate, 56 tall. The label is a sign above it, not a placeholder that
// disappears while typing.
export function Field({ label, ref, ...props }: TextInputProps & { label: string; ref?: Ref<TextInput> }) {
  const colourOf = useColour();
  return (
    <View className="gap-1.5">
      <SignText size="tag" ink="text-quiet-ink">
        {label}
      </SignText>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colourOf('quiet-ink')}
        className={plateClass({ className: 'h-14 px-3 text-[18px] text-ink focus:border-focus' })}
        {...props}
      />
    </View>
  );
}
