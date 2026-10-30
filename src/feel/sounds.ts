import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import type { Sound } from './moments';

const SOURCES: Record<Sound, number> = {
  scan: require('../../assets/sounds/scan.wav'),
  unknown: require('../../assets/sounds/unknown.wav'),
  refused: require('../../assets/sounds/refused.wav'),
  done: require('../../assets/sounds/done.wav'),
  found: require('../../assets/sounds/found.wav'),
  nothing: require('../../assets/sounds/nothing.wav'),
  tick: require('../../assets/sounds/tick.wav'),
};

// One player per sound for the life of the app: they're tiny, and a player made in advance plays at once.
const players: Partial<Record<Sound, AudioPlayer>> = {};
let prepared = false;

// The audio session for sound effects: the silent switch silences them (Android's silent and vibrate modes
// too), and they play over music or a radio without stopping it. Made ready when the app opens, so the
// first scan already beeps.
export function prepareSounds(): void {
  if (prepared) return;
  prepared = true;
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(
    () => undefined,
  );
  for (const sound of Object.keys(SOURCES) as Sound[]) playerFor(sound);
}

function playerFor(sound: Sound): AudioPlayer {
  // keepAudioSessionActive: a beep ending doesn't hand the audio session back, which would cost the next
  // beep its start and could nudge other apps' audio.
  const ready = players[sound];
  if (ready) return ready;
  const player = createAudioPlayer(SOURCES[sound], { keepAudioSessionActive: true });
  players[sound] = player;
  return player;
}

// From the start every time, so a second scan straight after the first still beeps.
export function playSound(sound: Sound): void {
  try {
    const player = playerFor(sound);
    player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    // A sound that can't play never stops the job.
  }
}
