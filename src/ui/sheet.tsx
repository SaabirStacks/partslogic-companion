import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Modal, Pressable, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { themeVars } from './palette';
import { Txt } from './text';
import { useScheme } from './theme';

// A sheet from the bottom over a dimmed screen: its title, then what it asks. Back and a tap outside close it, as
// its cancel button does. A screen reader lands on the title and stays inside the sheet. The sheets every job uses (ConfirmSheet,
// TextSheet, a pick row's Can't scan and Short pick) are built on it, so they open, close and look alike.
export function Sheet({
  visible,
  title,
  onClose,
  keyboard = false,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  // Lifts the sheet above the keyboard, for a sheet with a field.
  keyboard?: boolean;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const scheme = useScheme();
  // A screen reader starts on the sheet's title, not on the dimmed screen behind it (critique B).
  const titleRef = useRef<ViewInstance>(null);
  useEffect(() => {
    if (!visible) return;
    // After the slide in, so the title is on screen to take focus.
    const timer = setTimeout(() => {
      // Native only: the web review gallery's React Native has no accessibility events.
      if (titleRef.current && typeof AccessibilityInfo.sendAccessibilityEvent === 'function') {
        AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
      }
    }, 300);
    return () => clearTimeout(timer);
    // Again when a sheet moves to its next step (a new title), so focus never lands nowhere (critique B, round 2).
  }, [visible, title]);
  const content = (
    <>
      {/* A tap outside closes it; screen readers use the sheet's own Cancel instead of this. */}
      <Pressable
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        aria-hidden
        onPress={onClose}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
      />
      <View
        accessibilityViewIsModal
        role="dialog"
        aria-modal
        aria-label={title}
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        className="gap-4 rounded-t-[20px] border-t border-edge bg-ground px-4 pt-5">
        <View ref={titleRef} accessible accessibilityRole="header" accessibilityLabel={title}>
          <Txt variant="headline" className="font-extrabold">
            {title}
          </Txt>
        </View>
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
