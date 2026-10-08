import { router } from 'expo-router';

import { Icon } from '@/ui/icon';
import { PressablePlate } from '@/ui/plate';
import { SignText } from '@/ui/sign-text';

// Opens Add part for an unknown code, from wherever it was scanned: a small black sign.
export function AddPartLink({ code }: { code: string }) {
  return (
    <PressablePlate
      tone="plain"
      accessibilityLabel={`Add the part for ${code}`}
      onPress={() => router.push({ pathname: '/quick-add', params: { code } })}
      className="h-12 flex-row items-center gap-1.5 self-start px-3">
      <Icon name="add" size={18} colour="on-plain" />
      <SignText size="label" ink="text-on-plain">
        Add part
      </SignText>
    </PressablePlate>
  );
}
