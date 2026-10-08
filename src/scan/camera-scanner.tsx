import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { Linking, View } from 'react-native';

import { Button } from '@/ui/button';
import { Icon } from '@/ui/icon';
import { SignText } from '@/ui/sign-text';

import { Reticle } from './reticle';
import { useScanGate } from './use-scan-gate';

// Supplier barcodes (EAN, UPC, ITF-14), PartsLogic's own Code 128 labels, Code 39 and QR bin labels.
const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'code128', 'code39', 'qr'];

type CameraScannerProps = {
  onScan: (code: string) => void;
  // False pauses scanning (for example while a scan is being looked up) without closing the camera.
  enabled?: boolean;
};

// The live camera for every scanning screen, filling its parent. Only one camera preview can run at a
// time, so it closes whenever its screen is not the one in front.
export function CameraScanner({ onScan, enabled = true }: CameraScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const focused = useIsFocused();
  const accept = useScanGate();

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
    <View className="flex-1 bg-black">
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
      <Reticle />
    </View>
  );
}
