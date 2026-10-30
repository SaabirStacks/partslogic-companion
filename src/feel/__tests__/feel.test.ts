import { scanMoment } from '@/scan/feedback';
import type { ScanCheck } from '@/scan/resolve';

// Shared across module registries (each test loads feel afresh), hence the mock prefix jest allows.
const mockPlay = jest.fn();
const mockSeekTo = jest.fn(() => Promise.resolve());
const mockSetAudioMode = jest.fn((_mode: object) => Promise.resolve());
const mockNotify = jest.fn((_type: string) => Promise.resolve());
const mockImpact = jest.fn((_style: string) => Promise.resolve());
let mockStored: boolean | null = null;

jest.mock('expo-audio', () => ({
  createAudioPlayer: () => ({ play: mockPlay, seekTo: mockSeekTo }),
  setAudioModeAsync: (mode: object) => mockSetAudioMode(mode),
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: (type: string) => mockNotify(type),
  impactAsync: (style: string) => mockImpact(style),
  selectionAsync: () => Promise.resolve(),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));
jest.mock('@/lib/prefs', () => ({
  soundsPref: { get: () => mockStored, set: (value: boolean | null) => (mockStored = value) },
}));

// A fresh module per test, so the remembered on/off choice starts from what's stored.
function load() {
  let feel!: typeof import('../feel');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh copy per test needs require
    feel = require('../feel');
  });
  return feel;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStored = null;
});

test('sounds are on until turned off: a scan beeps and buzzes', () => {
  load().feel('scan');
  expect(mockNotify).toHaveBeenCalledWith('success');
  expect(mockSeekTo).toHaveBeenCalledWith(0);
  expect(mockPlay).toHaveBeenCalledTimes(1);
});

test('with sounds off the touch still plays and nothing beeps', () => {
  mockStored = false;
  load().feel('refused');
  expect(mockNotify).toHaveBeenCalledWith('error');
  expect(mockPlay).not.toHaveBeenCalled();
});

test('presses and red buttons are touch only', () => {
  const { feel } = load();
  feel('press');
  feel('firm');
  expect(mockImpact).toHaveBeenNthCalledWith(1, 'light');
  expect(mockImpact).toHaveBeenNthCalledWith(2, 'heavy');
  expect(mockPlay).not.toHaveBeenCalled();
});

test('turning sounds back on remembers it and plays the scan beep once', () => {
  mockStored = false;
  const { setSoundsEnabled, soundsEnabled } = load();
  setSoundsEnabled(true);
  expect(mockStored).toBe(true);
  expect(soundsEnabled()).toBe(true);
  expect(mockPlay).toHaveBeenCalledTimes(1);
  expect(mockSetAudioMode).toHaveBeenCalledWith(expect.objectContaining({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }));
});

test('turning sounds off is remembered and makes no sound', () => {
  const { setSoundsEnabled, soundsEnabled } = load();
  setSoundsEnabled(false);
  expect(mockStored).toBe(false);
  expect(soundsEnabled()).toBe(false);
  expect(mockPlay).not.toHaveBeenCalled();
});

test('a held scan sounds like what it found', () => {
  const part = { type: 'part' } as ScanCheck;
  const error = { type: 'error' } as ScanCheck;
  const unknown = { type: 'unknown' } as ScanCheck;
  const bin = { type: 'bin' } as ScanCheck;
  expect([part, error, unknown, bin].map(scanMoment)).toEqual(['scan', 'refused', 'unknown', 'unknown']);
});
