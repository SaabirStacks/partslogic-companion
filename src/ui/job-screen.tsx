import { useState, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useKeyboardShown } from '@/lib/use-keyboard';
import { CameraScanner } from '@/scan/camera-scanner';
import { ScanField } from '@/scan/scan-field';

import { Icon } from './icon';
import { KeyboardScreen } from './keyboard-screen';
import { APPEAR } from './motion';
import { OfflineBanner } from './offline-banner';
import { Scroll } from './scroll';
import { PressableCard } from './surface';

// Every scanning job is laid out the same way, so a scan always lands in the same place:
//   the camera on the top part of the screen, with the keyboard button in its corner for typed codes;
//   the result card rising over the camera's bottom edge;
//   the job's tally and lines below, scrolling;
//   the one main action pinned at the bottom (an ActionBar).
// While the keyboard is up (a typed code, a quantity), the screen sits above it and the camera shrinks to
// a strip, so the line being typed in stays in view.
export function JobScreen({
  onScan,
  onType,
  scanEnabled = true,
  onResume,
  typeFirst = false,
  placeholder,
  banner,
  result,
  children,
  action,
}: {
  onScan: (code: string) => void;
  // Typed codes go here when they mean something different from a scan (Look up searches them).
  onType?: (text: string) => void;
  // False pauses the camera (it dims and says Paused) and the typing box.
  scanEnabled?: boolean;
  // Scan next on the paused camera, for a job that resumes from the camera (Look up).
  onResume?: () => void;
  // Opens the typing box on arrival, for codes that are usually typed (a bin's name).
  typeFirst?: boolean;
  placeholder: string;
  // A strip above the camera that holds what the job is locked to, such as the bin being counted.
  banner?: ReactNode;
  result?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const { height } = useWindowDimensions();
  const [typing, setTyping] = useState(typeFirst);
  const keyboard = useKeyboardShown();

  return (
    <KeyboardScreen>
      <OfflineBanner />
      {banner}
      <View style={{ height: keyboard ? CAMERA_WHILE_TYPING : Math.max(200, Math.round(height * 0.34)) }}>
        <CameraScanner enabled={scanEnabled} onScan={onScan} onResume={onResume} />
        <View className="absolute inset-x-4 top-3 flex-row items-start justify-end gap-2">
          {typing ? (
            <Animated.View entering={APPEAR} style={{ flex: 1 }}>
              <ScanField autoFocus placeholder={placeholder} editable={scanEnabled} onSubmit={onType ?? onScan} />
            </Animated.View>
          ) : null}
          <PressableCard
            accessibilityLabel={typing ? 'Close typing' : 'Type a code'}
            onPress={() => setTyping((open) => !open)}
            className="h-12 w-12 items-center justify-center rounded-[10px]">
            <Icon name={typing ? 'close' : 'keyboard'} size={22} />
          </PressableCard>
        </View>
      </View>
      {result ? <View className="z-10 -mt-8 px-4">{result}</View> : null}
      <Scroll toEdge={!action} className="flex-1" contentContainerClassName="gap-3 px-4 pt-3">
        {children}
      </Scroll>
      {action}
    </KeyboardScreen>
  );
}

// Tall enough for the typing box over the camera (12 + 48), with the result card rising 32 over its edge.
const CAMERA_WHILE_TYPING = 96;
