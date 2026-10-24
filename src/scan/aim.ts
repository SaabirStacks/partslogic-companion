// Where a barcode sits against the aiming frame. expo-camera gives each read's bounds in the camera view's
// own coordinates; some reads come with empty bounds, and a platform could report them in another space.
// So this never decides on its own whether a read counts: it only says how far from the middle of the frame
// it is, and the scan gate prefers the nearest code when several are in view.

export type Box = { x: number; y: number; width: number; height: number };
export type ReadBounds = { origin: { x: number; y: number }; size: { width: number; height: number } };

// Distance from the read's centre to the frame's centre, or null when that can't be trusted (no frame yet,
// empty bounds, or a centre outside the camera view).
export function aimDistance(bounds: ReadBounds | undefined, frame: Box | null, view: { width: number; height: number } | null): number | null {
  if (!bounds || !frame || !view) return null;
  const { width, height } = bounds.size;
  if (!(width > 0) || !(height > 0)) return null;
  const x = bounds.origin.x + width / 2;
  const y = bounds.origin.y + height / 2;
  if (!(x >= 0 && x <= view.width && y >= 0 && y <= view.height)) return null;
  return Math.hypot(x - (frame.x + frame.width / 2), y - (frame.y + frame.height / 2));
}

// The aiming frame for a camera view of this size: nearly full width (a part label is long), a band across
// the middle.
const FRAME_SIDE = 24;
const FRAME_HEIGHT = 120;

export function aimFrame(view: { width: number; height: number }): Box {
  const height = Math.min(FRAME_HEIGHT, Math.max(48, view.height - 2 * FRAME_SIDE));
  return { x: FRAME_SIDE, y: (view.height - height) / 2, width: Math.max(0, view.width - 2 * FRAME_SIDE), height };
}
