import { View } from 'react-native';

import { Reticle } from './reticle';

// On the web the app is only the review gallery (src/dev/gallery.web.tsx), which has no camera: this draws
// the viewfinder the phone shows, so screens can be captured at phone size.
export function CameraScanner(_props: { onScan: (code: string) => void; enabled?: boolean }) {
  return (
    <View className="flex-1 bg-[#2a2c28]">
      <Reticle />
    </View>
  );
}
