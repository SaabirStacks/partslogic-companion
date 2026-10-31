import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { NetworkContext, phoneSaysOnline, worthAskingPartsLogic, type PhoneNetwork } from './network';
import { askPartsLogic } from './parts-logic-health';

// How often to look again while offline.
const RECHECK_MS = 5000;

// One watch on the connection for the whole app, so every screen, the outbox and the scan list agree on
// whether PartsLogic can be reached. The phone's change events alone can be missed (the phone asleep, the
// app in the background, Android still checking a Wi-Fi network), which left the app showing offline until
// it was restarted. So it also looks again whenever the app comes back to the front, and every few seconds
// while offline; and when the phone has a network it hasn't confirmed, it asks PartsLogic itself.
export function NetworkProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  // Checks can overlap (an event arrives while PartsLogic is being asked); only the latest one counts.
  const latest = useRef(0);

  const check = useCallback(async (given?: PhoneNetwork) => {
    const turn = ++latest.current;
    const state = given ?? (await getNetworkStateAsync().catch(() => null));
    if (!state) return;
    const reachable = phoneSaysOnline(state) || (worthAskingPartsLogic(state) && (await askPartsLogic()).ok);
    if (turn === latest.current) setOnline(reachable);
  }, []);

  useEffect(() => {
    void check();
    const changes = addNetworkStateListener((state) => void check(state));
    const foreground = AppState.addEventListener('change', (status) => {
      if (status === 'active') void check();
    });
    return () => {
      changes.remove();
      foreground.remove();
    };
  }, [check]);

  useEffect(() => {
    if (online) return;
    const timer = setInterval(() => void check(), RECHECK_MS);
    return () => clearInterval(timer);
  }, [online, check]);

  return <NetworkContext value={online}>{children}</NetworkContext>;
}
