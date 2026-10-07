import { useNetworkState } from 'expo-network';

// True unless the phone knows it has no connection (an unknown state counts as online, so nothing waits
// on a check that hasn't finished).
export function useOnline(): boolean {
  const state = useNetworkState();
  return state.isConnected !== false && state.isInternetReachable !== false;
}
