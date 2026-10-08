import { useState, type ReactNode } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { CameraScanner } from '@/scan/camera-scanner';
import { ScanField } from '@/scan/scan-field';

import { Icon } from './icon';
import { APPEAR } from './motion';
import { OfflineBanner } from './offline-banner';
import { PressablePlate } from './plate';

// Every scanning job is laid out the same way, so a scan always lands in the same place:
//   the camera on the top part of the screen, with the keyboard plate in its corner for typed codes;
//   the result plate rising over the camera's bottom edge;
//   the job's tally and lines below, scrolling;
//   the one main action pinned at the bottom (an ActionBar).
export function JobScreen({
  onScan,
  onType,
  scanEnabled = true,
  placeholder,
  banner,
  result,
  children,
  action,
}: {
  onScan: (code: string) => void;
  // Typed codes go here when they mean something different from a scan (Look up searches them).
  onType?: (text: string) => void;
  scanEnabled?: boolean;
  placeholder: string;
  // A plate above the camera that holds what the job is locked to, such as the bin being counted.
  banner?: ReactNode;
  result?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const { height } = useWindowDimensions();
  const [typing, setTyping] = useState(false);

  return (
    <View className="flex-1 bg-ground">
      <OfflineBanner />
      {banner}
      <View style={{ height: Math.max(200, Math.round(height * 0.34)) }}>
        <CameraScanner enabled={scanEnabled} onScan={onScan} />
        <View className="absolute inset-x-3 top-3 flex-row items-start justify-end gap-2">
          {typing ? (
            <Animated.View entering={APPEAR} style={{ flex: 1 }}>
              <ScanField autoFocus placeholder={placeholder} editable={scanEnabled} onSubmit={onType ?? onScan} />
            </Animated.View>
          ) : null}
          <PressablePlate
            accessibilityLabel={typing ? 'Close typing' : 'Type a code'}
            onPress={() => setTyping((open) => !open)}
            className="h-14 w-14 items-center justify-center">
            <Icon name={typing ? 'close' : 'keyboard'} size={24} />
          </PressablePlate>
        </View>
      </View>
      {result ? <View className="z-10 -mt-8 px-3">{result}</View> : null}
      <ScrollView keyboardShouldPersistTaps="handled" className="flex-1" contentContainerClassName="gap-3 px-3 pb-6 pt-3">
        {children}
      </ScrollView>
      {action}
    </View>
  );
}
