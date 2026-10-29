import { useEffect, useRef, type ReactNode } from 'react';
import { Keyboard, ScrollView, TextInput, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// How much room is left below the last thing in a list.
const END_GAP = 24;

// A screen's scrolling body.
//  - Taps reach buttons while the keyboard is up, and dragging the list puts the keyboard away.
//  - toEdge: the list runs to the bottom of the screen (no action bar under it), so its end clears the
//    phone's own buttons and home bar.
//  - When the keyboard comes up, the field being typed in is scrolled into view if it ended up under it
//    (React Native leaves that to the app on Android).
export function Scroll({
  toEdge = true,
  children,
  contentContainerStyle,
  ...props
}: Omit<ScrollViewProps, 'children'> & { toEdge?: boolean; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const inner = useRef<View>(null);
  const offset = useRef(0);
  const height = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      // After the screen has shrunk for the keyboard.
      timer = setTimeout(() => {
        const input = TextInput.State.currentlyFocusedInput();
        if (!input || !inner.current || !scroll.current) return;
        input.measureLayout(
          inner.current as never,
          (_x, y, _width, fieldHeight) => {
            const top = offset.current;
            const bottom = top + height.current;
            if (y < top + 8) scroll.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
            else if (y + fieldHeight > bottom - 8) scroll.current?.scrollTo({ y: y + fieldHeight - height.current + END_GAP, animated: true });
          },
          () => {
            // The field isn't in this list (the scan box over the camera, say).
          },
        );
      }, 150);
    });
    return () => {
      subscription.remove();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <ScrollView
      ref={scroll}
      innerViewRef={inner as never}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEventThrottle={32}
      {...props}
      onScroll={(event) => {
        offset.current = event.nativeEvent.contentOffset.y;
        props.onScroll?.(event);
      }}
      onLayout={(event) => {
        height.current = event.nativeEvent.layout.height;
        props.onLayout?.(event);
      }}
      contentContainerStyle={[contentContainerStyle, { paddingBottom: (toEdge ? insets.bottom : 0) + END_GAP }]}>
      {children}
    </ScrollView>
  );
}
