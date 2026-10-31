import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';

// What a developer needs to know about this copy of the app when something goes wrong: which version and
// update it runs, on which phone. Read from the app itself; nothing is sent anywhere unless shared.

export type AppFacts = {
  version: string;
  runtime: string;
  // The over-the-air update running, or "Built in" when it's the one the build shipped with.
  update: string;
  channel: string;
  phone: string;
};

export function appFacts(): AppFacts {
  return {
    version: Constants.expoConfig?.version ?? 'Unknown',
    runtime: Updates.runtimeVersion ?? 'Unknown',
    update: updateLabel(Updates.isEmbeddedLaunch, Updates.updateId, Updates.createdAt),
    channel: Updates.channel ?? (Updates.isEnabled ? 'None' : 'Updates off'),
    phone: [Device.modelName, [Device.osName, Device.osVersion].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || 'Unknown',
  };
}

export function updateLabel(embedded: boolean, id: string | null, createdAt: Date | null): string {
  if (embedded || !id) return 'Built in';
  const at = createdAt ? ` · ${createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : '';
  return `${id.slice(0, 8)}${at}`;
}

export type Diagnostics = {
  app: AppFacts;
  account: { email: string; userId: string; role: string };
  connection: string;
  sync: { waiting: number; needsAttention: number; lastSentAt: string | null; lastProblem: string | null };
};

// Everything on the Developer screen as plain text, for the share sheet (a bug report in a message).
export function diagnosticsText({ app, account, connection, sync }: Diagnostics): string {
  return [
    'PartsLogic phone details',
    `Version ${app.version} · runtime ${app.runtime} · update ${app.update} · channel ${app.channel}`,
    `Phone ${app.phone}`,
    `Signed in ${account.email} (${account.role}) · ${account.userId}`,
    `Connection ${connection}`,
    `Sync ${sync.waiting} waiting · ${sync.needsAttention} need attention · last sent ${sync.lastSentAt ?? 'never'}`,
    sync.lastProblem ? `Last problem ${sync.lastProblem}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

export type ConnectionFacts = { phone: string; partsLogic: string };

// What the phone says about its network ("Online (Wi-Fi)"), and whether PartsLogic answered ("Answered in
// 120 ms").
export function connectionFacts(
  network: { isConnected?: boolean | null; isInternetReachable?: boolean | null; type?: string | null } | null,
  answer: { ok: boolean; ms: number } | null,
): ConnectionFacts {
  const kind = network?.type ? (NETWORK_KINDS[network.type] ?? network.type.toLowerCase()) : null;
  const phone =
    network === null
      ? 'Phone not checked'
      : network.isConnected === false
        ? 'No network'
        : `${network.isInternetReachable === false ? 'Network, no internet' : 'Online'}${kind ? ` (${kind})` : ''}`;
  const partsLogic = answer === null ? 'Not asked' : answer.ok ? `Answered in ${answer.ms} ms` : 'Didn’t answer';
  return { phone, partsLogic };
}

// Both on one line, for the share text: "Online (Wi-Fi) · PartsLogic answered in 120 ms".
export function connectionText({ phone, partsLogic }: ConnectionFacts): string {
  return `${phone} · PartsLogic ${partsLogic.charAt(0).toLowerCase()}${partsLogic.slice(1)}`;
}

const NETWORK_KINDS: Record<string, string> = { WIFI: 'Wi-Fi', CELLULAR: 'mobile data', ETHERNET: 'cable', VPN: 'VPN', NONE: 'none' };
