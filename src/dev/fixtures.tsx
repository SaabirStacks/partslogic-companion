import type { ReactNode } from 'react';

import { OutboxContext, type OutboxContextValue } from '@/queue/outbox-provider';
import { ScanIndexContext, type ScanIndexContextValue } from '@/scan/scan-index-provider';
import { LocationContext, type LocationContextValue } from '@/session/location-provider';
import { SessionContext, type SessionContextValue } from '@/session/session-provider';
import type { SessionState } from '@/session/session-state';

// Dev-only stand-ins for the app's providers, so the review gallery can draw the real screens without
// signing in, a database or a network. Nothing here runs on a phone.

const noop = () => {};
const later = async () => {};

export const LOCATIONS = [
  { id: 1, code: 'MAIN', name: 'Main' },
  { id: 2, code: 'VAN1', name: 'Van 1' },
  { id: 3, code: 'BR2', name: 'Branch 2' },
];

export const MEMBER: SessionState = {
  status: 'member',
  email: 'counter@example.com',
  member: { userId: 'fixture', role: 'counter', workspaceName: 'Eclipse Auto Parts', currency: 'GBP' },
};

export function Fixtures({
  session = MEMBER,
  waiting = 0,
  needsAttention = 0,
  children,
}: {
  session?: SessionState;
  waiting?: number;
  needsAttention?: number;
  children: ReactNode;
}) {
  const sessionValue: SessionContextValue = { state: session, checking: false, signIn: async () => null, signOut: later, retry: noop };
  const locationValue: LocationContextValue = { location: LOCATIONS[0], locations: LOCATIONS, status: 'ready', choose: noop, refresh: noop };
  const outboxValue: OutboxContextValue = {
    enqueue: later,
    items: [],
    waiting,
    needsAttention,
    lastSentAt: null,
    lastProblem: null,
    retry: later,
    sendNow: noop,
  };
  const scanIndexValue: ScanIndexContextValue = { saved: null, progress: null, failed: false, update: noop };
  return (
    <SessionContext value={sessionValue}>
      <LocationContext value={locationValue}>
        <OutboxContext value={outboxValue}>
          <ScanIndexContext value={scanIndexValue}>{children}</ScanIndexContext>
        </OutboxContext>
      </LocationContext>
    </SessionContext>
  );
}
