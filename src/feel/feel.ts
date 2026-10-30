import { soundsPref } from '@/lib/prefs';

import { playHaptic } from './haptics';
import { MOMENTS, type Moment } from './moments';
import { playSound, prepareSounds } from './sounds';

let soundsOn: boolean | null = null;

// Sounds are on until someone turns them off in Account; the phone remembers the choice.
export function soundsEnabled(): boolean {
  soundsOn ??= soundsPref.get() ?? true;
  return soundsOn;
}

// Turning sounds on plays the scan beep, so whoever flicked the switch hears what it sounds like (and finds
// out straight away if the phone's silent switch is on).
export function setSoundsEnabled(on: boolean): void {
  soundsOn = on;
  soundsPref.set(on);
  if (on) {
    prepareSounds();
    playSound(MOMENTS.scan.sound);
  }
}

// When the app opens: ready the sounds so the first one plays on time. Nothing to ready when they're off.
export function prepareFeel(): void {
  if (soundsEnabled()) prepareSounds();
}

// The sound and touch for a moment (see moments.ts). The touch always plays; the sound only when sounds
// are on.
export function feel(moment: Moment): void {
  const { sound, haptic } = MOMENTS[moment];
  playHaptic(haptic);
  if (sound && soundsEnabled()) playSound(sound);
}
