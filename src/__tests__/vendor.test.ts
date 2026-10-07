// Proves the code copied from PartsLogic (src/vendor/partslogic) runs under this app's toolchain.
import { emptyBinSession, reduceBinSession, sessionLines, visibleLines } from '@/vendor/partslogic/shared/bin-session';
import { classifyQueueError } from '@/vendor/partslogic/shared/errors';
import { barcodeProblem, gtin14 } from '@/vendor/partslogic/shared/gtin';

describe('vendored PartsLogic code', () => {
  it('reads barcodes the way the database does', () => {
    expect(gtin14('4006381333931')).toBe('04006381333931');
    expect(gtin14('4006381333932')).toBeNull();
    expect(barcodeProblem('4006381333932')).toMatch(/last digit/);
  });

  it('keeps a zeroed line in the session so the 0 reaches the server', () => {
    let session = emptyBinSession('count-1', '2026-10-07T00:00:00.000Z');
    session = reduceBinSession(session, { type: 'scan', clientCountId: 'line-1', code: '4006381333931' });
    session = reduceBinSession(session, { type: 'scan', clientCountId: 'line-2', code: '4006381333931' });
    expect(visibleLines(session)).toEqual([{ clientCountId: 'line-1', code: '4006381333931', qty: 2, partId: null }]);

    session = reduceBinSession(session, { type: 'remove', clientCountId: 'line-1' });
    expect(visibleLines(session)).toEqual([]);
    expect(sessionLines(session)).toEqual([{ clientCountId: 'line-1', code: '4006381333931', qty: 0 }]);
  });

  it('retries passing trouble and surfaces broken rules', () => {
    expect(classifyQueueError({ code: '08006' })).toBe('retry');
    expect(classifyQueueError({ message: 'Network request failed' })).toBe('retry');
    expect(classifyQueueError({ code: '42501' })).toBe('needs_attention');
  });
});
