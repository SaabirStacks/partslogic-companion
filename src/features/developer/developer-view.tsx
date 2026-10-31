import { View } from 'react-native';

import { when } from '@/lib/format';
import { Button } from '@/ui/button';
import { Choice } from '@/ui/choice';
import { Fact, Facts } from '@/ui/facts';
import { Scroll } from '@/ui/scroll';
import { SectionLabel } from '@/ui/section-label';
import { Txt } from '@/ui/text';
import { APP_ROLES, type AppRole } from '@/vendor/partslogic/shared/members';
import { ROLE_HINTS, roleName } from '@/vendor/partslogic/shared/people';

import type { AppFacts, ConnectionFacts } from './app-facts';

// Every role a developer can preview the app as, highest first: all but their own.
const PREVIEW_ROLES = APP_ROLES.filter((role) => role !== 'developer').reverse();

export type OutboxFacts = { waiting: number; needsAttention: number; lastSentAt: string | null; lastProblem: string | null };

// The Developer screen as drawn: this copy of the app, the connection, the outbox, who is signed in, and
// Preview as a role.
export function DeveloperView({
  app,
  connection,
  checking,
  outbox,
  account,
  previewRole,
  onCheck,
  onOpenSync,
  onPreview,
  onShare,
}: {
  app: AppFacts;
  // null while it's being checked.
  connection: ConnectionFacts | null;
  checking: boolean;
  outbox: OutboxFacts;
  account: { email: string; userId: string };
  previewRole: AppRole | null;
  onCheck: () => void;
  onOpenSync: () => void;
  onPreview: (role: AppRole | null) => void;
  onShare: () => void;
}) {
  return (
    <Scroll className="bg-ground" contentContainerClassName="gap-3 px-4 pb-10 pt-3">
      <SectionLabel>This app</SectionLabel>
      <Facts>
        <Fact label="Version" value={app.version} />
        <Fact label="Runtime" value={app.runtime} />
        <Fact label="Update" value={app.update} selectable />
        <Fact label="Channel" value={app.channel} />
        <Fact label="Phone" value={app.phone} last />
      </Facts>

      <SectionLabel>Connection</SectionLabel>
      <Facts>
        <Fact label="Phone" value={connection?.phone ?? 'Checking…'} />
        <Fact label="PartsLogic" value={connection?.partsLogic ?? 'Checking…'} last />
      </Facts>
      <Button label="Check again" icon="retry" variant="secondary" compact onPress={onCheck} busy={checking} />

      <SectionLabel>Sync</SectionLabel>
      <Facts>
        <Fact label="Waiting" value={String(outbox.waiting)} />
        <Fact label="Problems" value={String(outbox.needsAttention)} />
        <Fact label="Last sent" value={outbox.lastSentAt ? when(outbox.lastSentAt) : 'Never'} />
        <Fact label="Last try" value={outbox.lastProblem ?? 'Fine'} last />
      </Facts>
      <Button label="Open Sync" icon="sync" variant="secondary" compact onPress={onOpenSync} />

      <SectionLabel>Signed in</SectionLabel>
      <Facts>
        <Fact label="Email" value={account.email} />
        <Fact label="User id" value={account.userId} selectable last />
      </Facts>

      <SectionLabel>Preview as</SectionLabel>
      <Txt variant="caption" className="px-1">
        See the app as another role sees it. PartsLogic still checks your own role, so what you can actually do doesn’t change.
      </Txt>
      <View accessibilityRole="radiogroup" className="gap-2">
        <Choice title="Developer (you)" detail="No preview" selected={previewRole === null} pick="role" onPress={() => onPreview(null)} />
        {PREVIEW_ROLES.map((role) => (
          <Choice key={role} title={roleName(role)} detail={ROLE_HINTS[role]} selected={previewRole === role} pick="role" onPress={() => onPreview(role)} />
        ))}
      </View>

      <Button label="Share these details" icon="share" variant="tinted" onPress={onShare} />
    </Scroll>
  );
}
