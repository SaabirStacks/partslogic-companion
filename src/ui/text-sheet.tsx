import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './button';
import { Field } from './field';
import { themeVars } from './palette';
import { StatusStrip } from './status-strip';
import { Txt } from './text';
import { useScheme } from './theme';

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
  const insets = useSafeAreaInsets();
  const scheme = useScheme();
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
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onCancel}>
      {/* A modal can draw outside the root view, so it sets the palette again for itself. */}
      <KeyboardAvoidingView behavior="padding" style={themeVars(scheme)} className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={onCancel}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
        />
        <View
          accessibilityViewIsModal
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          className="gap-4 rounded-t-[20px] border-t border-edge bg-ground px-4 pt-5">
          <Txt accessibilityRole="header" variant="headline" className="font-extrabold">
            {title}
          </Txt>
          <Field label={label} value={value} onChangeText={setValue} autoFocus returnKeyType="done" onSubmitEditing={save} editable={!busy} {...input} />
          {note ? <Txt variant="caption">{note}</Txt> : null}
          {problem ? <StatusStrip tone="stop" icon="stop" text={problem} /> : null}
          <View className="gap-2">
            <Button label={saveLabel} onPress={save} busy={busy} />
            <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={busy} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
