// The camera reports a barcode many times a second while it stays in view. A scan counts when the code is
// new, or when the same code comes back after it has been out of view for the cooldown, so holding a box
// in front of the camera never counts it twice.
export const SCAN_COOLDOWN_MS = 1200;

export type SeenCode = { code: string; seenAt: number } | null;

export function acceptScan(last: SeenCode, code: string, now: number, cooldownMs = SCAN_COOLDOWN_MS): boolean {
  return !last || last.code !== code || now - last.seenAt >= cooldownMs;
}
