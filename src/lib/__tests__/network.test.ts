import { phoneSaysOnline, worthAskingPartsLogic } from '../network';

test('online unless the phone knows there is no connection', () => {
  expect(phoneSaysOnline({ isConnected: true, isInternetReachable: true })).toBe(true);
  expect(phoneSaysOnline({})).toBe(true);
  expect(phoneSaysOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
  expect(phoneSaysOnline({ isConnected: false, isInternetReachable: false })).toBe(false);
  expect(phoneSaysOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
});

test('asks PartsLogic only when the phone has a network it has not confirmed', () => {
  expect(worthAskingPartsLogic({ isConnected: true, isInternetReachable: false })).toBe(true);
  expect(worthAskingPartsLogic({ isConnected: false, isInternetReachable: false })).toBe(false);
  expect(worthAskingPartsLogic({ isConnected: true, isInternetReachable: true })).toBe(false);
  expect(worthAskingPartsLogic({})).toBe(false);
});
