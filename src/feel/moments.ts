// The app's whole vocabulary of sound and touch, one row per kind of moment, so the same thing always
// feels the same wherever it happens. Sounds are short and only mark what staff need to know without
// looking: a scan read, something to check, a refusal, a finished job. Presses and choices are touch only,
// apart from a quiet tick. The tones themselves come from scripts/render-sounds.mjs.
export type Sound = 'scan' | 'unknown' | 'refused' | 'done' | 'found' | 'nothing' | 'tick';
export type Haptic = 'success' | 'warning' | 'error' | 'selection' | 'light' | 'heavy';

export const MOMENTS = {
  // A barcode is read and it's what the job expects.
  scan: { sound: 'scan', haptic: 'success' },
  // Not in PartsLogic, a doubtful match, or not what this step needs: look at the screen.
  unknown: { sound: 'unknown', haptic: 'warning' },
  // PartsLogic said no, or the phone couldn't ask.
  refused: { sound: 'refused', haptic: 'error' },
  // A delivery, count, stock take, move or new part is finished.
  done: { sound: 'done', haptic: 'success' },
  // A look-up filled in a part's details, or found nothing.
  found: { sound: 'found', haptic: 'success' },
  nothing: { sound: 'nothing', haptic: 'warning' },
  // − and +, switches, choosing one of a list.
  tick: { sound: 'tick', haptic: 'selection' },
  // The main button on a screen.
  press: { sound: null, haptic: 'light' },
  // A red button: sign out, throw a job away.
  firm: { sound: null, haptic: 'heavy' },
} as const satisfies Record<string, { sound: Sound | null; haptic: Haptic }>;

export type Moment = keyof typeof MOMENTS;
// The moments a press can make: what PressableCard takes as its haptic.
export type TouchMoment = 'press' | 'tick' | 'firm';
