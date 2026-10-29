import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { useWorkingLocation } from '@/session/location-provider';
import { Button } from '@/ui/button';
import { Choice } from '@/ui/choice';
import { Txt } from '@/ui/text';
import { StatusStrip } from '@/ui/status-strip';
import { useColour } from '@/ui/theme';
import { Scroll } from '@/ui/scroll';

// Sheet for picking the working location. This phone remembers the choice.
export default function LocationSheet() {
  const { location, locations, status, choose, refresh } = useWorkingLocation();
  const colourOf = useColour();

  return (
    <Scroll className="bg-ground" contentContainerClassName="gap-3 px-4 pt-6">
      <Txt accessibilityRole="header" variant="headline">
        Location
      </Txt>

      {status === 'loading' && locations.length === 0 ? (
        <ActivityIndicator accessibilityLabel="Loading locations" color={colourOf('quiet-ink')} className="py-8" />
      ) : null}
      {status === 'stale' && locations.length > 0 ? (
        <StatusStrip tone="warn" icon="offline" text="Saved list · no signal" />
      ) : null}
      {status === 'stale' && locations.length === 0 ? (
        <>
          <StatusStrip tone="stop" icon="offline" text="Locations didn’t load" />
          <Button label="Try again" icon="retry" variant="secondary" onPress={refresh} />
        </>
      ) : null}
      {status === 'ready' && locations.length === 0 ? (
        <StatusStrip tone="warn" icon="location" text="No locations yet · an editor adds them in the back office" />
      ) : null}

      {locations.map((item) => {
        return (
          <Choice
            key={item.id}
            title={item.name}
            detail={item.code.toLowerCase() !== item.name.toLowerCase() ? item.code : null}
            selected={item.id === location?.id}
            accessibilityLabel={`${item.name}, ${item.code}`}
            onPress={() => {
              choose(item);
              router.back();
            }}
          />
        );
      })}
    </Scroll>
  );
}
