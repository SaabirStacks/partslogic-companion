import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Icon } from '@/ui/icon';
import { plateClass } from '@/ui/plate';
import { useColour } from '@/ui/theme';

// Typed entry for when a barcode won't scan. Bluetooth and USB scanners type into it too: they send the
// code followed by Enter, and the field stays open and ready for the next one.
export function ScanField({
  placeholder,
  onSubmit,
  editable = true,
  autoFocus = false,
}: {
  placeholder: string;
  onSubmit: (text: string) => void;
  editable?: boolean;
  autoFocus?: boolean;
}) {
  const colourOf = useColour();
  const [text, setText] = useState('');

  return (
    <View className={plateClass({ className: 'h-14 flex-row items-center gap-2 px-3' })}>
      <Icon name="keyboard" size={20} colour="quiet-ink" />
      <TextInput
        accessibilityLabel={placeholder}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colourOf('quiet-ink')}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType="search"
        submitBehavior="submit"
        editable={editable}
        onSubmitEditing={() => {
          const value = text.trim();
          if (!value) return;
          setText('');
          onSubmit(value);
        }}
        className="h-14 flex-1 font-sign-bold text-[22px] text-ink"
      />
    </View>
  );
}
