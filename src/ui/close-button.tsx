import { router } from 'expo-router';

import { Icon } from './icon';
import { PressableCard } from './surface';

// The header button that closes a screen opened over the app (People, Developer).
export function CloseButton({ label }: { label: string }) {
  return (
    <PressableCard accessibilityLabel={label} onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-[10px]">
      <Icon name="close" size={18} />
    </PressableCard>
  );
}
