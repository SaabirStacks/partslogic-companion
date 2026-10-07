import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { cx } from './cx';
import { useColour } from './theme';

function Step({ label, symbol, onPress, disabled }: { label: string; symbol: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      className={cx('h-11 w-11 items-center justify-center rounded-full bg-canvas active:opacity-70', disabled && 'opacity-40')}>
      <Text className="text-xl font-semibold text-ink">{symbol}</Text>
    </Pressable>
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
      <View className="flex-row items-center gap-2">
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
          className="h-11 w-20 rounded-xl border border-focus bg-paper px-3 text-center text-lg tabular-nums text-ink"
        />
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-1">
      <Step label={`One fewer ${name}`} symbol="−" onPress={() => onStep(-1)} disabled={total <= 0} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${total} of ${name}. Type a total`}
        onPress={() => {
          setText(String(total));
          setEditing(true);
        }}
        className="h-11 min-w-12 items-center justify-center px-1">
        <Text className="text-lg font-semibold tabular-nums text-ink">{total}</Text>
      </Pressable>
      <Step label={`One more ${name}`} symbol="+" onPress={() => onStep(1)} />
    </View>
  );
}
