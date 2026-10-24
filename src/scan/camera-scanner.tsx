import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { Linking, View } from 'react-native';

import { Button } from '@/ui/button';
import { Icon } from '@/ui/icon';
import { SignText } from '@/ui/sign-text';

import { aimDistance } from './aim';
import { classifyRead, PRODUCT_SYMBOLOGIES } from './code-kind';
import { Reticle, useAimFrame } from './reticle';
import { useScanGate } from './use-scan-gate';

const BARCODE_TYPES = [...PRODUCT_SYMBOLOGIES];

type CameraScannerProps = {
  onScan: (code: string) => void;
  // False pauses scanning without closing the camera: while a scan is looked up, and while the job waits for
  // the person to confirm the scan it has. The camera dims and says Paused.
  enabled?: boolean;
  // Offered on the paused camera as Scan next, for jobs that resume from the camera itself.
  onResume?: () => void;
};

// The live camera for every scanning screen, filling its parent. Only one camera preview can run at a
// time, so it closes whenever its screen is not the one in front. Each read goes through the same steps:
// is it a product or supplier barcode (code-kind.ts), and is it a new, steady scan of the code nearest the
// aiming frame (scan-gate.ts)? One scan at a time reaches the job.
export function CameraScanner({ onScan, enabled = true, onResume }: CameraScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const focused = useIsFocused();
  const gate = useScanGate();
  const { onLayout, view, frame } = useAimFrame();

  // Scanning again after a pause: the box just handled has to leave view before it counts again.
  useEffect(() => {
    if (enabled) gate.release();
  }, [enabled, gate]);

  if (!permission) return <View className="flex-1 bg-black" />;

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-black px-8">
        <View className="flex-row items-center gap-2">
          <Icon name="barcode" size={28} colour="warning" />
          <SignText size="title" weight="heavy" ink="text-warning">
            Camera off
          </SignText>
        </View>
        <View className="self-stretch">
          {permission.canAskAgain ? (
            <Button label="Allow camera" onPress={() => void requestPermission()} />
          ) : (
            <Button label="Open settings" variant="secondary" onPress={() => void Linking.openSettings()} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black" onLayout={onLayout}>
      {focused ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          onBarcodeScanned={
            enabled
              ? (result) => {
                  const read = classifyRead(result);
                  if (read.kind === 'ignore') return;
                  const scanned = gate.read(read.code, aimDistance(result.bounds, frame, view));
                  if (scanned) onScan(scanned);
                }
              : undefined
          }
        />
      ) : null}
      <Reticle frame={frame} paused={!enabled} onResume={onResume} />
    </View>
  );
}
