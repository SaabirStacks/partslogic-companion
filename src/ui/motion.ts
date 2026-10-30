import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  FadeOut,
  FadeOutDown,
  FadeOutUp,
  LinearTransition,
  ReduceMotion,
  ZoomIn,
} from 'react-native-reanimated';

// The app's few moves, in one place. Motion only ever shows a change of state (a scan landing, a line
// arriving, a total changing), fast enough that nobody waits for it. With the
// system's Reduce Motion on, anything that travels or grows is switched off; fades stay, as Apple and
// Material both recommend.

export const EASE_OUT = Easing.out(Easing.exp);

// The result card rising over the camera after a scan.
export const RISE = FadeInDown.duration(160).easing(EASE_OUT).reduceMotion(ReduceMotion.System);

// The result card leaving the way it came once its scan is dealt with, faster than it arrived.
export const DROP = FadeOutDown.duration(120).reduceMotion(ReduceMotion.System);

// Something new arriving in place: a resume row, a changed status. FADE is its exit (the camera's dim
// lifting). Fades stay with Reduce Motion: they carry the state change without moving anything.
export const APPEAR = FadeIn.duration(160).reduceMotion(ReduceMotion.Never);
export const FADE = FadeOut.duration(120).reduceMotion(ReduceMotion.Never);

// The no-signal strip dropping in under the header, and lifting away when signal is back.
export const BANNER_IN = FadeInUp.duration(200).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
export const BANNER_OUT = FadeOutUp.duration(150).reduceMotion(ReduceMotion.System);

// A tick landing on the one chosen (a location, a supplier, a bin).
export const TICK_IN = ZoomIn.duration(160).easing(EASE_OUT).reduceMotion(ReduceMotion.System);

// The app's one authored moment: a status chip turning to its new state when PartsLogic answers
// (Sending to Delivery booked, Counting to Counted). The new colour sweeps across from the symbol's side
// and the symbol lands (status-chip.tsx).
export const SWEEP_MS = 300;
export const LAND_MS = 220;

// A switch between two or three views (Supplier | Manufacturer): the white selector slides across.
export const SLIDE_MS = 200;

// The next set of choices arriving from the side being moved towards: deeper (an aisle, then its letters)
// from the right, a step back from the left.
export const STEP_IN = FadeInRight.duration(180).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
export const STEP_BACK = FadeInLeft.duration(180).easing(EASE_OUT).reduceMotion(ReduceMotion.System);

// Neighbours sliding to make room when a line is added or removed.
export const SETTLE = LinearTransition.duration(180).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
