import { useState } from 'react';
import { View, type TextInputProps } from 'react-native';

import { Button } from './button';
import { Field } from './field';
import { Sheet } from './sheet';
import { StatusStrip } from './status-strip';
import { Txt } from './text';

// Changing one thing that's typed (a name, an email): a sheet from the bottom with the field, Save and
// Cancel, the way ConfirmSheet asks before a job ends. onSave resolves to a message when it wasn't saved,
// which stays in the sheet, or null, which closes it. Pass a key that changes each time it opens, so the
// field starts from the current value.
export function TextSheet({
  visible,
  title,
  label,
  initial,
  note,
  saveLabel = 'Save',
  input,
  onSave,
  onCancel,
}: {
  visible: boolean;
  title: string;
  label: string;
  initial: string;
  note?: string | null;
  saveLabel?: string;
  input?: Omit<TextInputProps, 'value' | 'onChangeText'>;
  onSave: (value: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    const message = await onSave(value);
    setBusy(false);
    setProblem(message);
  }

  return (
    <Sheet visible={visible} title={title} onClose={onCancel} keyboard>
      <Field label={label} value={value} onChangeText={setValue} autoFocus returnKeyType="done" onSubmitEditing={save} editable={!busy} {...input} />
      {note ? <Txt variant="caption">{note}</Txt> : null}
      {problem ? <StatusStrip tone="stop" icon="stop" text={problem} /> : null}
      <View className="gap-2">
        <Button label={saveLabel} onPress={save} busy={busy} />
        <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={busy} />
      </View>
    </Sheet>
  );
}
