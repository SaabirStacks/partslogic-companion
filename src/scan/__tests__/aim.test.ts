import { aimDistance, aimFrame } from '../aim';

const view = { width: 400, height: 280 };
const frame = aimFrame(view);
const at = (x: number, y: number, width = 100, height = 40) => ({ origin: { x, y }, size: { width, height } });

describe('aimFrame', () => {
  it('is a band across the middle of the camera, nearly full width', () => {
    expect(frame).toEqual({ x: 24, y: 80, width: 352, height: 120 });
  });

  it('still fits a short camera view', () => {
    const small = aimFrame({ width: 300, height: 100 });
    expect(small.y).toBeGreaterThanOrEqual(0);
    expect(small.y + small.height).toBeLessThanOrEqual(100);
  });
});

describe('aimDistance', () => {
  it('is 0 for a barcode in the middle of the frame and grows away from it', () => {
    expect(aimDistance(at(150, 120), frame, view)).toBe(0);
    expect(aimDistance(at(150, 10), frame, view)).toBeGreaterThan(aimDistance(at(150, 100), frame, view)!);
  });

  it('has no answer without bounds, a frame or a sensible position', () => {
    expect(aimDistance(undefined, frame, view)).toBeNull();
    expect(aimDistance(at(10, 10, 0, 0), frame, view)).toBeNull();
    expect(aimDistance(at(150, 120), null, view)).toBeNull();
    expect(aimDistance(at(1500, 900), frame, view)).toBeNull();
  });
});
