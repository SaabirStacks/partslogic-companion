import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { useWorkingLocation } from '@/session/location-provider';
import { Button } from '@/ui/button';
import { Icon } from '@/ui/icon';
import { PressablePlate, TEXT_ON } from '@/ui/plate';
import { SignText } from '@/ui/sign-text';
import { StatusStrip } from '@/ui/status-strip';
import { useColour } from '@/ui/theme';

// Sheet for picking the working location. This phone remembers the choice.
export default function LocationSheet() {
  const { location, locations, status, choose, refresh } = useWorkingLocation();
  const colourOf = useColour();

  return (
    <ScrollView className="bg-ground" contentContainerClassName="gap-3 px-4 pb-10 pt-6">
      <SignText accessibilityRole="header" size="headline" weight="heavy">
        Location
      </SignText>

      {status === 'loading' && locations.length === 0 ? (
        <ActivityIndicator accessibilityLabel="Loading locations" color={colourOf('quiet-ink')} className="py-8" />
      ) : null}
      {status === 'stale' && locations.length > 0 ? (
        <StatusStrip tone="warning" icon="offline" text="Saved list · no signal" />
      ) : null}
      {status === 'stale' && locations.length === 0 ? (
        <>
          <StatusStrip tone="stop" icon="offline" text="Locations didn’t load" />
          <Button label="Try again" icon="retry" variant="secondary" onPress={refresh} />
        </>
      ) : null}
      {status === 'ready' && locations.length === 0 ? (
        <StatusStrip tone="warning" icon="location" text="No locations yet · an editor adds them in the back office" />
      ) : null}

      {locations.map((item) => {
        const selected = item.id === location?.id;
        const tone = selected ? 'mandatory' : 'surface';
        return (
          <PressablePlate
            key={item.id}
            tone={tone}
            accessibilityState={{ selected }}
            accessibilityLabel={`${item.name}, ${item.code}`}
            onPress={() => {
              choose(item);
              router.back();
            }}
            className="min-h-16 flex-row items-center gap-3 px-4 py-2">
            <View className="flex-1">
              <SignText size="title" weight="heavy" ink={TEXT_ON[tone]} numberOfLines={1}>
                {item.name}
              </SignText>
              {item.code.toLowerCase() !== item.name.toLowerCase() ? (
                <SignText size="tag" ink={selected ? TEXT_ON[tone] : 'text-quiet-ink'}>
                  {item.code}
                </SignText>
              ) : null}
            </View>
            {selected ? <Icon name="check" size={24} colour="on-mandatory" /> : null}
          </PressablePlate>
        );
      })}
    </ScrollView>
  );
}
