import type { SyncState } from '@/features/board/sync-state';

import { Icon } from './icon';
import { PressableCard, TONE_INK } from './surface';
import { Txt } from './text';

// The two small pills under the app's name: where this phone is working, and whether its work has reached
// PartsLogic. Each opens the screen that changes or explains it. The sync pill's symbol takes its state's
// colour; the words stay dark so they read on white.

export function LocationPill({ name, onPress }: { name: string | null; onPress: () => void }) {
  return (
    <PressableCard
      accessibilityLabel={name ? `Working location: ${name}. Change` : 'Choose a working location'}
      onPress={onPress}
      className="min-h-11 flex-row items-center gap-1.5 rounded-[10px] px-3">
      <Icon name="location" size={16} colour="action-ink" />
      <Txt variant="caption" ink="text-ink" numberOfLines={1} className="font-semibold">
        {name ?? 'Choose location'}
      </Txt>
    </PressableCard>
  );
}

export function SyncPill({ state, onPress }: { state: SyncState; onPress: () => void }) {
  return (
    <PressableCard
      accessibilityLabel={`${state.label}. Open sync`}
      onPress={onPress}
      className="min-h-11 flex-row items-center gap-1.5 rounded-[10px] px-3">
      <Icon name={state.icon} size={16} colour={TONE_INK[state.tone]} />
      <Txt variant="caption" ink="text-ink" numberOfLines={1} className="font-semibold">
        {state.label}
      </Txt>
    </PressableCard>
  );
}
