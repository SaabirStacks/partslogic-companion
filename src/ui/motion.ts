import { Easing, FadeIn, FadeInDown, LinearTransition, ReduceMotion } from 'react-native-reanimated';

// The app's few moves, in one place. Motion only ever shows a change of state (a scan landing, a line
// arriving, a total changing), fast enough that nobody waits for it. With the
// system's Reduce Motion on, anything that travels or grows is switched off; fades stay, as Apple and
// Material both recommend.

export const EASE_OUT = Easing.out(Easing.exp);

// The result plate rising over the camera after a scan.
export const RISE = FadeInDown.duration(160).easing(EASE_OUT).reduceMotion(ReduceMotion.System);

// Something new arriving in place: a resume plate, a changed status.
export const APPEAR = FadeIn.duration(160).reduceMotion(ReduceMotion.Never);

// Neighbours sliding to make room when a line is added or removed.
export const SETTLE = LinearTransition.duration(180).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
