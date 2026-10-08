import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { useWorkingLocation } from '@/session/location-provider';
import { Button } from '@/ui/button';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icon';
import { useColour } from '@/ui/theme';

// Sheet for picking the working location. This phone remembers the choice.
export default function LocationSheet() {
  const { location, locations, status, choose, refresh } = useWorkingLocation();
  const colourOf = useColour();

  return (
    <ScrollView contentContainerClassName="gap-4 px-4 pb-10 pt-6">
      <View className="gap-1 px-2">
        <Text accessibilityRole="header" className="text-xl font-semibold text-ink">
          Where are you working?
        </Text>
        <Text className="text-base leading-6 text-quiet-ink">
          Deliveries and bin counts use this location. This phone remembers it.
        </Text>
      </View>

      {status === 'loading' && locations.length === 0 ? (
        <ActivityIndicator accessibilityLabel="Loading locations" color={colourOf('quiet-ink')} className="py-8" />
      ) : null}

      {status === 'stale' ? (
        <View className="gap-3 px-2">
          <Text accessibilityRole="alert" className="text-base text-quiet-ink">
            {locations.length > 0
              ? "Couldn't refresh the list, so this is the one saved on this phone."
              : "Couldn't load the locations. Check your signal and try again."}
          </Text>
          {locations.length === 0 ? <Button label="Try again" variant="secondary" onPress={refresh} /> : null}
        </View>
      ) : null}

      {status === 'ready' && locations.length === 0 ? (
        <Text className="px-2 text-base text-quiet-ink">
          There are no locations yet. An editor can add them in the PartsLogic back office.
        </Text>
      ) : null}

      {locations.length > 0 ? (
        <View className="overflow-hidden rounded-xl bg-plate">
          {locations.map((item, index) => {
            const selected = item.id === location?.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${item.name}, ${item.code}`}
                onPress={() => {
                  choose(item);
                  router.back();
                }}
                className={cx(
                  'min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-ground',
                  index < locations.length - 1 && 'border-b border-rule',
                )}>
                <View className="flex-1 gap-0.5">
                  <Text className="text-base text-ink">{item.name}</Text>
                  <Text className="text-sm text-quiet-ink">{item.code}</Text>
                </View>
                {selected ? <Icon name="check" size={18} colour="mandatory-ink" /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}
