import { Fragment } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/ui/button';
import { APPEAR } from '@/ui/motion';
import { PlaceholderRows } from '@/ui/placeholder';
import { Scroll } from '@/ui/scroll';
import { SectionLabel } from '@/ui/section-label';
import { StatusStrip } from '@/ui/status-strip';
import { Card } from '@/ui/surface';
import type { Person } from '@/vendor/partslogic/shared/people';

import { peopleSections } from './people-text';
import { PersonRow } from './person-row';

// The People list as drawn: Add a person, then those waiting for a role, then everyone with access.
export function PeopleList({
  people,
  loading,
  problem,
  online,
  onAdd,
  onOpen,
  onRefresh,
}: {
  people: Person[] | undefined;
  loading: boolean;
  problem: string | null;
  online: boolean;
  onAdd: () => void;
  onOpen: (person: Person) => void;
  onRefresh: () => void;
}) {
  const sections = people ? peopleSections(people) : [];
  return (
    <Scroll className="bg-ground" contentContainerClassName="gap-3 px-4 pb-10 pt-3" onRefresh={online ? onRefresh : undefined} refreshing={loading && !!people}>
      {!online ? <StatusStrip tone="warn" icon="offline" text="Offline · connect to see and change people" /> : null}
      <Button label="Add a person" icon="addPerson" variant="tinted" disabled={!online} onPress={onAdd} />
      {problem ? (
        <View className="gap-2">
          <StatusStrip tone="stop" icon="stop" text={problem} />
          <Button label="Try again" icon="retry" variant="secondary" onPress={onRefresh} />
        </View>
      ) : null}
      {loading && !people ? <PlaceholderRows count={5} label="Loading people" /> : null}
      {sections.map((section) => (
        <Fragment key={section.title}>
          <SectionLabel>{section.title}</SectionLabel>
          <Animated.View entering={APPEAR}>
            <Card className="overflow-hidden">
              {section.people.map((person, index) => (
                <PersonRow key={person.userId} person={person} first={index === 0} onPress={() => onOpen(person)} />
              ))}
            </Card>
          </Animated.View>
        </Fragment>
      ))}
    </Scroll>
  );
}
