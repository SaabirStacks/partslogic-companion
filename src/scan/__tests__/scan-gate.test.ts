import { CLEAR_MS, emptyGate, gateRead, gateRelease, STEADY_MS, type GateState } from '../scan-gate';

// Feeds reads of [code, time, distance?] through the gate and returns the scans it let through.
function run(reads: [string, number, (number | null)?][], start: GateState = emptyGate) {
  let state = start;
  const scans: string[] = [];
  for (const [code, at, distance] of reads) {
    const next = gateRead(state, code, at, distance ?? null);
    state = next.state;
    if (next.accepted) scans.push(next.accepted);
  }
  return { scans, state };
}

describe('the scan gate', () => {
  it('counts a code once it has been read twice in the window', () => {
    expect(run([['A', 0]]).scans).toEqual([]);
    expect(run([['A', 0], ['A', 40]]).scans).toEqual(['A']);
  });

  it('never counts a one-off misread', () => {
    expect(run([['A', 0], ['B', 40], ['A', 40 + STEADY_MS]]).scans).toEqual([]);
  });

  it('counts a code read only twice a second (a phone held still)', () => {
    expect(run([['A', 0], ['A', 500]]).scans).toEqual(['A']);
  });

  it('ignores the code just scanned while it stays in view', () => {
    const reads: [string, number][] = [['A', 0], ['A', 40]];
    for (let at = 80; at < 5000; at += 300) reads.push(['A', at]);
    expect(run(reads).scans).toEqual(['A']);
  });

  it('counts the same code again once it has been out of view', () => {
    expect(run([['A', 0], ['A', 40], ['A', 40 + CLEAR_MS + 10], ['A', 40 + CLEAR_MS + 50]]).scans).toEqual(['A', 'A']);
  });

  it('counts a different code straight away, even while the last one is in view', () => {
    expect(run([['A', 0], ['A', 40], ['B', 80], ['A', 100], ['B', 120]]).scans).toEqual(['A', 'B']);
  });

  it('with two codes in view, takes the one nearest the aiming frame', () => {
    const reads: [string, number, number][] = [
      ['FAR', 0, 200],
      ['NEAR', 10, 20],
      ['FAR', 40, 200],
      ['NEAR', 50, 20],
    ];
    expect(run(reads).scans).toEqual(['NEAR']);
  });

  it('takes a code with no position when it is the only one in view', () => {
    expect(run([['A', 0, null], ['A', 40, null]]).scans).toEqual(['A']);
  });

  it('does not wait forever on a nearer code that was a misread', () => {
    const reads: [string, number, number][] = [
      ['NEAR', 0, 10],
      ['FAR', 10, 200],
      ['FAR', 40, 200],
      ['FAR', STEADY_MS + 20, 200],
    ];
    expect(run(reads).scans).toEqual(['FAR']);
  });

  it('after a pause, a box still in view is not read again', () => {
    const first = run([['A', 0], ['A', 40]]);
    // Paused for 10 s (no reads), then scanning resumes with the box still in front of the camera.
    const resumed = gateRelease(first.state, 10_000);
    expect(run([['A', 10_050], ['A', 10_100], ['A', 10_400]], resumed).scans).toEqual([]);
    expect(run([['A', 10_000 + CLEAR_MS + 10], ['A', 10_000 + CLEAR_MS + 60]], resumed).scans).toEqual(['A']);
  });
});
