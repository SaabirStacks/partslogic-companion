import { View } from 'react-native';

import { Reticle, useAimFrame } from './reticle';

// On the web the app is only the review gallery (src/dev/gallery.web.tsx), which has no camera: this draws
// the viewfinder the phone shows, paused or not, so screens can be captured at phone size.
export function CameraScanner({ enabled = true, onResume }: { onScan: (code: string) => void; enabled?: boolean; onResume?: () => void }) {
  const { onLayout, frame } = useAimFrame();
  return (
    <View className="flex-1 bg-[#2a2c28]" onLayout={onLayout}>
      <Reticle frame={frame} paused={!enabled} onResume={onResume} />
    </View>
  );
}
