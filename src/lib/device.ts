import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';

import { installIdPref } from './prefs';

// Sent as p_device with receipts and counts, so the back office can tell which phone did the work.
export function deviceLabel(): string {
  let id = installIdPref.get();
  if (!id) {
    id = Crypto.randomUUID();
    installIdPref.set(id);
  }
  return `${Device.modelName ?? 'Phone'} ${id.slice(0, 8)}`;
}
