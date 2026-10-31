import { View } from 'react-native';

import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icon';
import { PressableCard } from '@/ui/surface';
import { Txt } from '@/ui/text';
import { personLabel, type Person } from '@/vendor/partslogic/shared/people';

import { personDetail } from './people-text';

// One person in the People list: their name (or email), "You" for the signed-in person, their role and
// when they last signed in. Someone waiting for a role carries a yellow mark, since they can't work yet.
export function PersonRow({ person, first, onPress }: { person: Person; first: boolean; onPress: () => void }) {
  const detail = personDetail(person);
  return (
    <PressableCard
      accessibilityLabel={`${personLabel(person)}${person.isMe ? ', you' : ''}, ${detail}`}
      onPress={onPress}
      depth="flat"
      className={cx('rounded-none border-0', !first && 'border-t border-rule')}>
      <View className="min-h-16 flex-row items-center gap-3 px-4 py-3">
        {person.role === null ? (
          <View className="h-9 w-9 items-center justify-center rounded-full bg-warn-soft">
            <Icon name="warning" size={16} colour="warn-ink" />
          </View>
        ) : (
          <View className="h-9 w-9 items-center justify-center rounded-full bg-rule">
            <Txt variant="label" className="font-bold">
              {personLabel(person).charAt(0).toUpperCase()}
            </Txt>
          </View>
        )}
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            <Txt variant="label" numberOfLines={2} className="shrink font-bold">
              {personLabel(person)}
            </Txt>
            {person.isMe ? (
              <Txt variant="caption" className="font-semibold">
                You
              </Txt>
            ) : null}
          </View>
          {person.name ? (
            <Txt variant="caption" numberOfLines={1}>
              {person.email}
            </Txt>
          ) : null}
          <Txt variant="caption" numberOfLines={2}>
            {detail}
          </Txt>
        </View>
        <Icon name="forward" size={16} colour="quiet-ink" />
      </View>
    </PressableCard>
  );
}
