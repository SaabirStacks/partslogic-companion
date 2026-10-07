import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { Linking, Text, View } from 'react-native';

import { Button } from '@/ui/button';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icon';

import { useScanGate } from './use-scan-gate';

// Supplier barcodes (EAN, UPC, ITF-14), PartsLogic's own Code 128 labels, Code 39 and QR bin labels.
const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'code128', 'code39', 'qr'];

type CameraScannerProps = {
  onScan: (code: string) => void;
  // False pauses scanning (for example while a scan is being looked up) without closing the camera.
  enabled?: boolean;
  className?: string;
};

// The live camera for every scanning screen. Only one camera preview can run at a time, so it closes
// whenever its screen is not the one in front.
export function CameraScanner({ onScan, enabled = true, className }: CameraScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const focused = useIsFocused();
  const accept = useScanGate();

  const frame = cx('overflow-hidden rounded-2xl bg-ink', className);

  if (!permission) return <View className={frame} />;

  if (!permission.granted) {
    return (
      <View className={cx(frame, 'items-center justify-center gap-3 bg-paper px-6 py-6')}>
        <Icon name="barcode" size={32} colour="quiet-ink" />
        <Text className="text-center text-base leading-6 text-ink">
          {permission.canAskAgain
            ? 'Allow the camera to scan barcodes and bin labels. You can always type instead.'
            : 'Camera access is off for PartsLogic. Turn it on in Settings, or type instead.'}
        </Text>
        <View className="self-stretch">
          {permission.canAskAgain ? (
            <Button label="Allow camera" onPress={() => void requestPermission()} />
          ) : (
            <Button label="Open Settings" variant="secondary" onPress={() => void Linking.openSettings()} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View className={frame}>
      {focused ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          onBarcodeScanned={
            enabled
              ? ({ data }) => {
                  const code = data.trim();
                  if (code && accept(code)) onScan(code);
                }
              : undefined
          }
        />
      ) : null}
      <View pointerEvents="none" className="absolute inset-x-8 top-1/2 h-24 -translate-y-12 rounded-xl border-2 border-on-tint/70" />
    </View>
  );
}
