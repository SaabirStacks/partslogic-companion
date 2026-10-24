// The camera reports every barcode in view many times a second. The gate turns that stream into scans:
//   steady: a code counts once it has been read twice within STEADY_MS, so a one-frame misread never does;
//   nearest: with several codes in view, the one nearest the middle of the aiming frame wins (a code with
//     no usable position comes last, but still counts when it's alone);
//   held: the code just scanned is ignored while it stays in view, and counts again only after it has been
//     out of view for CLEAR_MS (or when the job resumes and it has gone).
// Pure, so it's tested without a camera.

// expo-camera drops a read identical to the last within 500 ms, so a phone held dead still reads a code about
// twice a second: the window has room for two reads.
export const STEADY_MS = 1000;
export const STEADY_READS = 2;
export const CLEAR_MS = 1000;

type Seen = { times: number[]; distance: number | null };
export type GateState = { seen: Record<string, Seen>; held: { code: string; lastSeenAt: number } | null };

export const emptyGate: GateState = { seen: {}, held: null };

const rank = (distance: number | null) => distance ?? Number.POSITIVE_INFINITY;

export function gateRead(
  state: GateState,
  code: string,
  now: number,
  distance: number | null = null,
): { state: GateState; accepted: string | null } {
  let held = state.held;
  if (held && now - held.lastSeenAt >= CLEAR_MS) held = null;
  if (held && held.code === code) return { state: { ...state, held: { code, lastSeenAt: now } }, accepted: null };

  // Forget reads older than the window, then add this one.
  const seen: Record<string, Seen> = {};
  for (const [key, value] of Object.entries(state.seen)) {
    const times = value.times.filter((at) => now - at < STEADY_MS);
    if (times.length > 0) seen[key] = { ...value, times };
  }
  seen[code] = { times: [...(seen[code]?.times ?? []), now], distance };

  const steady = seen[code].times.length >= STEADY_READS;
  const nearer = Object.entries(seen).some(([key, value]) => key !== code && rank(value.distance) < rank(distance));
  if (!steady || nearer) return { state: { seen, held }, accepted: null };
  return { state: { seen: {}, held: { code, lastSeenAt: now } }, accepted: code };
}

// The job is scanning again after a pause: the code it paused on must leave view before it counts again.
export function gateRelease(state: GateState, now: number): GateState {
  return { seen: {}, held: state.held ? { code: state.held.code, lastSeenAt: now } : null };
}
