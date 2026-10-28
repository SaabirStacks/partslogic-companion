import { useState, type ReactNode } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { CameraScanner } from '@/scan/camera-scanner';
import { ScanField } from '@/scan/scan-field';

import { Icon } from './icon';
import { APPEAR } from './motion';
import { OfflineBanner } from './offline-banner';
import { PressableCard } from './surface';

// Every scanning job is laid out the same way, so a scan always lands in the same place:
//   the camera on the top part of the screen, with the keyboard button in its corner for typed codes;
//   the result card rising over the camera's bottom edge;
//   the job's tally and lines below, scrolling;
//   the one main action pinned at the bottom (an ActionBar).
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

  return (
    <View className="flex-1 bg-ground">
      <OfflineBanner />
      {banner}
      <View style={{ height: Math.max(200, Math.round(height * 0.34)) }}>
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
      <ScrollView keyboardShouldPersistTaps="handled" className="flex-1" contentContainerClassName="gap-3 px-4 pb-6 pt-3">
        {children}
      </ScrollView>
      {action}
    </View>
  );
}
