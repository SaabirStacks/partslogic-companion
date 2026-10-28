import { TextInput, View, type TextInputProps } from 'react-native';

import { Icon } from './icon';
import { useColour } from './theme';

// A search box over a list you pick from: the magnifier, then what's typed. The placeholder says what
// is searched ("Search suppliers"), so it needs no label above it.
export function SearchInput({ placeholder, ...props }: TextInputProps & { placeholder: string }) {
  const colourOf = useColour();
  return (
    <View className="min-h-14 flex-row items-center gap-2 rounded-card border-[1.5px] border-edge bg-surface px-4">
      <Icon name="lookup" size={18} colour="quiet-ink" />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={colourOf('quiet-ink')}
        autoCorrect={false}
        returnKeyType="search"
        className="flex-1 py-3 text-[17px] text-ink"
        {...props}
      />
    </View>
  );
}
