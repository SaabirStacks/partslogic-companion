import { View } from 'react-native';

import { useSession } from '@/session/session-provider';
import { Button } from '@/ui/button';
import { Icon } from '@/ui/icon';
import { Txt } from '@/ui/text';
import { roleName } from '@/vendor/partslogic/shared/people';

// While a developer previews the app as another role: a plain strip that says which, with Stop, so the
// board never quietly looks like someone else's.
export function PreviewStrip() {
  const { previewRole, setPreviewRole } = useSession();
  if (!previewRole) return null;
  return (
    <View accessibilityRole="alert" className="flex-row items-center gap-3 rounded-card bg-action-soft px-3 py-2">
      <Icon name="preview" size={18} colour="action-ink" />
      <Txt variant="caption" ink="text-action-ink" className="flex-1 font-semibold">
        {`Previewing as ${roleName(previewRole)}`}
      </Txt>
      <View className="w-24">
        <Button label="Stop" variant="secondary" compact onPress={() => setPreviewRole(null)} />
      </View>
    </View>
  );
}
