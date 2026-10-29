import { useContext, type ReactNode } from 'react';
import { KeyboardAvoidingView } from 'react-native';
import { HeaderHeightContext } from 'expo-router/react-navigation';

import { cx } from './cx';

// A screen with something to type in: when the keyboard comes up, the screen shrinks to the space above it,
// so the field being typed in and the action bar stay in view. Padding on both platforms: Android draws
// edge to edge, so the window no longer shrinks for the keyboard by itself. The offset is the stack header
// above the screen (none on screens without one, or outside a navigator); a full-screen modal over a screen
// with a header passes topOffset 0.
export function KeyboardScreen({ children, className, topOffset }: { children: ReactNode; className?: string; topOffset?: number }) {
  const header = useContext(HeaderHeightContext) ?? 0;
  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={topOffset ?? header} className={cx('flex-1 bg-ground', className)}>
      {children}
    </KeyboardAvoidingView>
  );
}
