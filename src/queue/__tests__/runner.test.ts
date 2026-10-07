import type { QueueItem } from '@/vendor/partslogic/shared/bin-session';
import { DataError } from '@/vendor/partslogic/shared/errors';

import { backoffMs, runOutbox } from '../runner';
import { MemoryStore } from './memory-store';

const lines = (clientId: string, documentId: string, codes: string[]): QueueItem => ({
  kind: 'receipt_lines',
  clientId,
  documentId,
  locationId: 1,
  lines: codes.map((code, i) => ({ clientLineId: `${clientId}-${i}`, code, qty: 1 })),
});
const close = (clientId: string, documentId: string): QueueItem => ({ kind: 'close_receipt', clientId, documentId });

async function storeWith(...payloads: QueueItem[]) {
  const store = new MemoryStore();
  for (const payload of payloads) await store.enqueue({ userId: 'u1', payload, label: payload.clientId });
  return store;
}

describe('runOutbox', () => {
  it('sends everything in order', async () => {
    const store = await storeWith(lines('a', 'R1', ['1']), close('b', 'R1'));
    const sent: string[] = [];
    const report = await runOutbox(store, 'u1', async (payload) => void sent.push(payload.clientId));
    expect(sent).toEqual(['a', 'b']);
    expect(report).toEqual({ sent: 2, stoppedBy: null, needsAttention: 0 });
    expect(store.items.every((row) => row.status === 'done')).toBe(true);
  });

  it('holds back the rest of a stream after a refusal, but not other streams', async () => {
    const store = await storeWith(lines('a', 'R1', ['1']), lines('x', 'R2', ['9']), close('b', 'R1'));
    const sent: string[] = [];
    const report = await runOutbox(store, 'u1', async (payload) => {
      if (payload.clientId === 'a') throw new DataError('Not allowed', '42501');
      sent.push(payload.clientId);
    });
    expect(sent).toEqual(['x']);
    expect(report.needsAttention).toBe(1);
    expect(store.items.map((row) => row.status)).toEqual(['attention', 'done', 'pending']);
  });

  it('stops everything on a passing failure and keeps the item for later', async () => {
    const store = await storeWith(lines('a', 'R1', ['1']), lines('x', 'R2', ['9']));
    const report = await runOutbox(store, 'u1', async () => {
      throw new Error('Network request failed');
    });
    expect(report.stoppedBy).toBe('Network request failed');
    expect(store.items.map((row) => [row.status, row.attempts])).toEqual([
      ['pending', 1],
      ['pending', 0],
    ]);
  });

  it("only sends the signed-in user's work", async () => {
    const store = await storeWith(lines('a', 'R1', ['1']));
    await store.enqueue({ userId: 'u2', payload: lines('z', 'R9', ['1']), label: 'z' });
    const sent: string[] = [];
    await runOutbox(store, 'u1', async (payload) => void sent.push(payload.clientId));
    expect(sent).toEqual(['a']);
  });

  it('sends an item a person retried', async () => {
    const store = await storeWith(lines('a', 'R1', ['1']));
    await store.attention('a', 'Refused');
    await store.retry('a');
    const report = await runOutbox(store, 'u1', async () => undefined);
    expect(report.sent).toBe(1);
  });
});

describe('coalescing', () => {
  const append = (code: string) => (existing: QueueItem) =>
    existing.kind === 'receipt_lines'
      ? { payload: { ...existing, lines: [...existing.lines, { clientLineId: code, code, qty: 1 }] }, label: 'merged' }
      : null;

  it('appends to the newest unsent item of the same stream and kind', async () => {
    const store = await storeWith(lines('a', 'R1', ['1']));
    await store.enqueue({ userId: 'u1', payload: lines('b', 'R1', ['2']), label: 'b' }, append('2'));
    expect(store.items).toHaveLength(1);
    expect(store.items[0].payload.kind === 'receipt_lines' && store.items[0].payload.lines.map((l) => l.code)).toEqual([
      '1',
      '2',
    ]);
  });

  it('adds a new item once the newest one is being sent or another kind follows it', async () => {
    const store = await storeWith(lines('a', 'R1', ['1']), close('c', 'R1'));
    await store.enqueue({ userId: 'u1', payload: lines('b', 'R1', ['2']), label: 'b' }, append('2'));
    expect(store.items).toHaveLength(3);

    const claimed = await storeWith(lines('a', 'R1', ['1']));
    await claimed.claim('a');
    await claimed.enqueue({ userId: 'u1', payload: lines('b', 'R1', ['2']), label: 'b' }, append('2'));
    expect(claimed.items).toHaveLength(2);
  });
});

describe('backoffMs', () => {
  it('doubles up to a minute', () => {
    expect([1, 2, 3, 10].map(backoffMs)).toEqual([2000, 4000, 8000, 60000]);
  });
});
