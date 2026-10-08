import type { SyncState } from '@/features/board/sync-state';

import { Icon } from './icon';
import { ON_TONE, PressablePlate, TEXT_ON } from './plate';
import { SignText } from './sign-text';

// The two plates at the top of the board: where this phone is working, and whether its work has reached
// PartsLogic. Both open the screen that changes or explains them.

export function LocationPlate({ name, onPress }: { name: string | null; onPress: () => void }) {
  return (
    <PressablePlate
      accessibilityLabel={name ? `Working location: ${name}. Change` : 'Choose a working location'}
      onPress={onPress}
      className="min-h-12 flex-1 flex-row items-center gap-2 px-3">
      <Icon name="location" size={20} colour="mandatory-ink" />
      <SignText size="label" weight="heavy" numberOfLines={1} className="flex-1">
        {name ?? 'Choose location'}
      </SignText>
      <Icon name="chevron" size={16} />
    </PressablePlate>
  );
}

export function SyncPlate({ state, onPress }: { state: SyncState; onPress: () => void }) {
  return (
    <PressablePlate
      tone={state.tone}
      accessibilityLabel={`${state.label}. Open sync`}
      onPress={onPress}
      className="min-h-12 flex-1 flex-row items-center gap-2 px-3">
      <Icon name={state.icon} size={20} colour={ON_TONE[state.tone]} />
      <SignText size="label" weight="heavy" numberOfLines={1} ink={TEXT_ON[state.tone]} className="flex-1">
        {state.label}
      </SignText>
    </PressablePlate>
  );
}
