import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Icon } from './icon';
import { plateClass, PressablePlate } from './plate';
import { SignText } from './sign-text';
import { useColour } from './theme';

function Step({ label, icon, onPress, disabled }: { label: string; icon: 'minus' | 'plus'; onPress: () => void; disabled?: boolean }) {
  return (
    <PressablePlate accessibilityLabel={label} disabled={disabled} onPress={onPress} className="h-12 w-12 items-center justify-center">
      <Icon name={icon} size={22} />
    </PressablePlate>
  );
}

// − total +, and tap the total to type a box quantity. Reports changes, never edits in place: the caller
// decides how a change is recorded.
export function Quantity({
  total,
  name,
  onStep,
  onSet,
}: {
  total: number;
  name: string;
  onStep: (change: 1 | -1) => void;
  onSet: (target: number) => void;
}) {
  const colourOf = useColour();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  if (editing) {
    return (
      <TextInput
        autoFocus
        accessibilityLabel={`Total for ${name}`}
        value={text}
        onChangeText={setText}
        keyboardType="number-pad"
        returnKeyType="done"
        selectTextOnFocus
        placeholder={String(total)}
        placeholderTextColor={colourOf('quiet-ink')}
        onSubmitEditing={() => {
          const target = Number(text);
          setEditing(false);
          if (text.trim() !== '' && Number.isFinite(target)) onSet(target);
        }}
        onBlur={() => setEditing(false)}
        className={plateClass({ className: 'h-12 w-24 border-focus text-center font-sign-heavy text-[28px] text-ink' })}
      />
    );
  }

  return (
    <View className="flex-row items-center gap-1">
      <Step label={`One fewer ${name}`} icon="minus" onPress={() => onStep(-1)} disabled={total <= 0} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${total} of ${name}. Type a total`}
        onPress={() => {
          setText(String(total));
          setEditing(true);
        }}
        className="h-12 min-w-12 items-center justify-center px-1">
        <SignText size="display" weight="heavy">
          {total}
        </SignText>
      </Pressable>
      <Step label={`One more ${name}`} icon="plus" onPress={() => onStep(1)} />
    </View>
  );
}
