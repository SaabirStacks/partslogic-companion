import { connectionFacts, connectionText, diagnosticsText, updateLabel } from '../app-facts';

// The app's own modules aren't needed by the wording helpers (jest hoists these above the import).
jest.mock('expo-updates', () => ({}));
jest.mock('expo-device', () => ({}));
jest.mock('expo-constants', () => ({ __esModule: true, default: {} }));

describe('updateLabel', () => {
  it('names the update running, or says the build’s own', () => {
    expect(updateLabel(true, 'abc', null)).toBe('Built in');
    expect(updateLabel(false, null, null)).toBe('Built in');
    expect(updateLabel(false, '0193f1a2-5555-7777-8888-999999999999', new Date('2026-10-31T09:00:00'))).toBe('0193f1a2 · 31 Oct');
  });
});

describe('diagnosticsText', () => {
  it('puts everything a bug report needs on a few lines', () => {
    const text = diagnosticsText({
      app: { version: '1.1.0', runtime: '1.1.0', update: 'Built in', channel: 'production', phone: 'iPhone 17 · iOS 27.0' },
      account: { email: 'dev@example.com', userId: 'u1', role: 'developer' },
      connection: 'Online · PartsLogic answered in 120 ms',
      sync: { waiting: 2, needsAttention: 0, lastSentAt: null, lastProblem: 'timeout' },
    });
    expect(text.split('\n')).toEqual([
      'PartsLogic phone details',
      'Version 1.1.0 · runtime 1.1.0 · update Built in · channel production',
      'Phone iPhone 17 · iOS 27.0',
      'Signed in dev@example.com (developer) · u1',
      'Connection Online · PartsLogic answered in 120 ms',
      'Sync 2 waiting · 0 need attention · last sent never',
      'Last problem timeout',
    ]);
  });
});

describe('connectionText', () => {
  it('says what the phone sees and whether PartsLogic answered', () => {
    const line = (...args: Parameters<typeof connectionFacts>) => connectionText(connectionFacts(...args));
    expect(connectionFacts({ isConnected: true, isInternetReachable: true, type: 'WIFI' }, { ok: true, ms: 120 })).toEqual({
      phone: 'Online (Wi-Fi)',
      partsLogic: 'Answered in 120 ms',
    });
    expect(line({ isConnected: true, isInternetReachable: true, type: 'WIFI' }, { ok: true, ms: 120 })).toBe(
      'Online (Wi-Fi) · PartsLogic answered in 120 ms',
    );
    expect(line({ isConnected: true, isInternetReachable: false, type: 'CELLULAR' }, { ok: false, ms: 4000 })).toBe(
      'Network, no internet (mobile data) · PartsLogic didn’t answer',
    );
    expect(line({ isConnected: false }, null)).toBe('No network · PartsLogic not asked');
    expect(line(null, null)).toBe('Phone not checked · PartsLogic not asked');
  });
});
