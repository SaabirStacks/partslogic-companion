import { streamKeyOf } from '../stream';

describe('streamKeyOf', () => {
  it('groups a delivery, a bin count and a bin by their ids', () => {
    expect(streamKeyOf({ kind: 'close_receipt', clientId: 'c', documentId: 'R1' })).toBe('receipt:R1');
    expect(streamKeyOf({ kind: 'commit_bin_count', clientId: 'c', stocktakeId: 'S1', confirmEmpty: false })).toBe(
      'count:S1',
    );
    expect(streamKeyOf({ kind: 'ensure_bin', clientId: 'c', locationId: 3, code: 'a-07' })).toBe('bin:3:A-07');
    expect(streamKeyOf({ kind: 'quick_add', clientId: 'q1', number: '123' })).toBe('quick-add:q1');
  });
});
