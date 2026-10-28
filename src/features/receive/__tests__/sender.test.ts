import { cleanReference, deliveryName, readSender, receiptDetails, REFERENCE_MAX } from '../sender';

describe('cleanReference', () => {
  it('trims the delivery note and drops a blank one', () => {
    expect(cleanReference('  DN 448210 ')).toBe('DN 448210');
    expect(cleanReference('   ')).toBeNull();
    expect(cleanReference(null)).toBeNull();
  });

  it('keeps no more than PartsLogic stores', () => {
    expect(cleanReference('x'.repeat(80))).toHaveLength(REFERENCE_MAX);
  });
});

describe('receiptDetails', () => {
  it('sends a supplier as its source, with the delivery note', () => {
    expect(receiptDetails('c1', 'R1', { kind: 'supplier', id: 7, name: 'BGA' }, 'DN 448210')).toEqual({
      kind: 'receipt_details',
      clientId: 'c1',
      documentId: 'R1',
      sourceId: 7,
      brandId: null,
      reference: 'DN 448210',
    });
  });

  it('sends a manufacturer as its brand', () => {
    expect(receiptDetails('c1', 'R1', { kind: 'manufacturer', id: 3, name: 'Bosch' }, null)).toMatchObject({
      sourceId: null,
      brandId: 3,
      reference: null,
    });
  });

  it('sends nothing when there is nothing to say', () => {
    expect(receiptDetails('c1', 'R1', null, null)).toBeNull();
  });
});

describe('readSender', () => {
  it('reads a saved sender back', () => {
    expect(readSender(JSON.stringify({ kind: 'supplier', id: 7, name: 'BGA' }))).toEqual({ kind: 'supplier', id: 7, name: 'BGA' });
  });

  it('treats missing or malformed values as no sender', () => {
    expect(readSender(null)).toBeNull();
    expect(readSender('not json')).toBeNull();
    expect(readSender(JSON.stringify({ kind: 'carrier', id: 1, name: 'X' }))).toBeNull();
    expect(readSender(JSON.stringify({ kind: 'supplier', id: '7', name: 'BGA' }))).toBeNull();
  });
});

describe('deliveryName', () => {
  it('names a delivery by who it is from', () => {
    expect(deliveryName({ kind: 'supplier', id: 7, name: 'BGA' })).toBe('BGA');
    expect(deliveryName(null)).toBe('Delivery');
  });
});
