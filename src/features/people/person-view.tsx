import type { ReactNode } from 'react';
import Animated from 'react-native-reanimated';

import { when } from '@/lib/format';
import { Button } from '@/ui/button';
import { Fact, Facts } from '@/ui/facts';
import { APPEAR } from '@/ui/motion';
import { Scroll } from '@/ui/scroll';
import { SectionLabel } from '@/ui/section-label';
import { StatusStrip } from '@/ui/status-strip';
import { roleAtLeast, type AppRole } from '@/vendor/partslogic/shared/members';
import { rolesYouCanGive, roleName, type Person } from '@/vendor/partslogic/shared/people';

import { RoleChoices } from './role-choices';

export type Outcome = { ok: boolean; text: string };

// One person's page as drawn: name and email (pressable when they can be changed), when they signed up and
// last signed in, their role as choices, and the sign-in actions. Who may change what follows the server's
// rules (person.canChange): never yourself apart from your name (and an admin's own email), never someone
// above your role. children is for the sheets the page opens.
export function PersonView({
  person,
  myRole,
  online,
  outcome,
  busy,
  onName,
  onEmail,
  onRole,
  onNewCode,
  onRemove,
  onRefresh,
  children,
}: {
  person: Person;
  myRole: AppRole;
  online: boolean;
  outcome: Outcome | null;
  busy: boolean;
  onName: () => void;
  onEmail: () => void;
  onRole: (role: AppRole) => void;
  onNewCode: () => void;
  onRemove: () => void;
  onRefresh?: () => void;
  children?: ReactNode;
}) {
  const changeable = person.canChange && online;
  const canName = online && (person.canChange || person.isMe) && person.role !== null;
  const canEmail = online && (person.canChange || (person.isMe && roleAtLeast(myRole, 'admin')));

  return (
    <Scroll className="bg-ground" contentContainerClassName="gap-3 px-4 pb-12 pt-3" onRefresh={online ? onRefresh : undefined}>
      {!online ? <StatusStrip tone="warn" icon="offline" text="Offline · connect to change people" /> : null}
      {outcome ? (
        <Animated.View key={outcome.text} entering={APPEAR}>
          <StatusStrip tone={outcome.ok ? 'ok' : 'stop'} icon={outcome.ok ? 'sent' : 'stop'} text={outcome.text} />
        </Animated.View>
      ) : null}

      <Facts>
        <Fact label="Name" value={person.name ?? 'No name yet'} onPress={canName ? onName : undefined} />
        <Fact label="Email" value={person.email} onPress={canEmail ? onEmail : undefined} />
        <Fact label="Signed up" value={when(person.signedUpAt)} />
        <Fact
          label="Signed in"
          value={person.needsPassword ? 'Set-up code not used yet' : person.lastSignedInAt ? when(person.lastSignedInAt) : 'Never'}
          last
        />
      </Facts>

      {person.isMe ? (
        <StatusStrip tone="neutral" icon="account" text="This is you. Another admin changes your role or access." />
      ) : !person.canChange && person.role ? (
        <StatusStrip tone="neutral" icon="locked" text={`${roleName(person.role)} is above your role, so you can’t change them.`} />
      ) : null}

      <SectionLabel>{person.role ? 'Role' : 'Give them a role'}</SectionLabel>
      {person.role === null && changeable ? (
        <StatusStrip tone="warn" icon="warning" text="Until they have a role they see “No access yet”." />
      ) : null}
      {changeable ? (
        <RoleChoices roles={rolesYouCanGive(myRole)} value={person.role} onChoose={onRole} disabled={busy} />
      ) : (
        <Facts>
          <Fact label="Role" value={person.role ? roleName(person.role) : 'None yet'} last />
        </Facts>
      )}

      {changeable && person.role ? (
        <>
          <SectionLabel>Sign-in</SectionLabel>
          <Button label="New set-up code" icon="key" variant="secondary" onPress={onNewCode} disabled={busy} />
          <Button label="Remove access" icon="stop" variant="destructive" onPress={onRemove} disabled={busy} />
        </>
      ) : null}
      {children}
    </Scroll>
  );
}
