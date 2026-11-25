import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { themeVars } from './palette';
import { Txt } from './text';
import { useScheme } from './theme';

// A sheet from the bottom over a dimmed screen: its title, then what it asks. Back and a tap outside close it, as
// its cancel button does (named by closeLabel for screen readers). The sheets every job uses (ConfirmSheet,
// TextSheet, a pick row's Can't scan and Short pick) are built on it, so they open, close and look alike.
export function Sheet({
  visible,
  title,
  closeLabel = 'Cancel',
  onClose,
  keyboard = false,
  children,
}: {
  visible: boolean;
  title: string;
  closeLabel?: string;
  onClose: () => void;
  // Lifts the sheet above the keyboard, for a sheet with a field.
  keyboard?: boolean;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const scheme = useScheme();
  const content = (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        onPress={onClose}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
      />
      <View
        accessibilityViewIsModal
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        className="gap-4 rounded-t-[20px] border-t border-edge bg-ground px-4 pt-5">
        <Txt accessibilityRole="header" variant="headline" className="font-extrabold">
          {title}
        </Txt>
        {children}
      </View>
    </>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      {/* A modal can draw outside the root view, so it sets the palette again for itself. */}
      {keyboard ? (
        <KeyboardAvoidingView behavior="padding" style={themeVars(scheme)} className="flex-1 justify-end">
          {content}
        </KeyboardAvoidingView>
      ) : (
        <View style={themeVars(scheme)} className="flex-1 justify-end">
          {content}
        </View>
      )}
    </Modal>
  );
}
