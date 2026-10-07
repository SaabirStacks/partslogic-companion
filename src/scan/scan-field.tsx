import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Icon } from '@/ui/icon';
import { useColour } from '@/ui/theme';

// Typed entry for when a barcode won't scan. Bluetooth and USB scanners type into it too: they send the
// code followed by Enter.
export function ScanField({
  placeholder,
  onSubmit,
  editable = true,
}: {
  placeholder: string;
  onSubmit: (text: string) => void;
  editable?: boolean;
}) {
  const colourOf = useColour();
  const [text, setText] = useState('');

  return (
    <View className="h-12 flex-row items-center gap-2 rounded-xl border border-hairline bg-paper px-4">
      <Icon name="lookup" size={18} colour="quiet-ink" />
      <TextInput
        accessibilityLabel={placeholder}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colourOf('quiet-ink')}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="search"
        editable={editable}
        onSubmitEditing={() => {
          const value = text.trim();
          if (!value) return;
          setText('');
          onSubmit(value);
        }}
        className="h-12 flex-1 text-base text-ink"
      />
    </View>
  );
}
