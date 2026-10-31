import { createContext, use } from 'react';

// What the phone says about its connection (expo-network's NetworkState, the parts this app reads).
export type PhoneNetwork = { isConnected?: boolean | null; isInternetReachable?: boolean | null };

// Online unless the phone knows it has no connection. An unknown state counts as online, so nothing waits
// on a check that hasn't finished.
export function phoneSaysOnline(state: PhoneNetwork): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

// The phone has a network but hasn't confirmed the internet. Android confirms by asking Google, which some
// workplace Wi-Fi blocks; PartsLogic itself may still answer, so it's worth asking it directly.
export function worthAskingPartsLogic(state: PhoneNetwork): boolean {
  return state.isConnected === true && state.isInternetReachable === false;
}

// Whether the app can reach PartsLogic, kept by NetworkProvider (network-provider.tsx) for the whole app.
// Outside it (the web review gallery, tests) the app counts as online.
export const NetworkContext = createContext(true);

export function useOnline(): boolean {
  return use(NetworkContext);
}
