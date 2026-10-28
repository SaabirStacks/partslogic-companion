import { router } from 'expo-router';

import { Icon } from '@/ui/icon';
import { PressableCard } from '@/ui/surface';
import { Txt } from '@/ui/text';

// Opens Add part for an unknown code, from wherever it was scanned: a small white button.
export function AddPartLink({ code }: { code: string }) {
  return (
    <PressableCard
      tone="neutral"
      accessibilityLabel={`Add the part for ${code}`}
      onPress={() => router.push({ pathname: '/quick-add', params: { code } })}
      className="h-12 flex-row items-center gap-1.5 self-start px-3">
      <Icon name="add" size={18} colour="ink" />
      <Txt variant="label" ink="text-ink">
        Add part
      </Txt>
    </PressableCard>
  );
}
