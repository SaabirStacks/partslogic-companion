import { filterSenders, rememberSender, senderList, type SenderOption } from '../sender-options';

const supplier = (id: number, name: string): SenderOption => ({ kind: 'supplier', id, name, detail: null });
const SUPPLIERS = [supplier(1, 'APEC'), supplier(2, 'BGA'), supplier(3, 'Euro Car Parts'), supplier(4, 'FPS')];

describe('filterSenders', () => {
  it('matches any part of the name, ignoring case and spaces', () => {
    expect(filterSenders(SUPPLIERS, 'carparts').map((s) => s.name)).toEqual(['Euro Car Parts']);
    expect(filterSenders(SUPPLIERS, 'bg').map((s) => s.name)).toEqual(['BGA']);
    expect(filterSenders(SUPPLIERS, '  ')).toHaveLength(4);
  });
});

describe('rememberSender', () => {
  it('puts the one just used first, once, and keeps eight', () => {
    const recent = [2, 3, 4, 5, 6, 7, 8, 9].map((id) => ({ kind: 'supplier' as const, id, name: `S${id}` }));
    const next = rememberSender(recent, { kind: 'supplier', id: 4, name: 'S4' });
    expect(next.map((s) => s.id)).toEqual([4, 2, 3, 5, 6, 7, 8, 9]);
    expect(rememberSender(recent, { kind: 'supplier', id: 1, name: 'S1' })).toHaveLength(8);
  });

  it('keeps a supplier and a manufacturer with the same id apart', () => {
    const next = rememberSender([{ kind: 'supplier', id: 3, name: 'FPS' }], { kind: 'manufacturer', id: 3, name: 'Bosch' });
    expect(next).toHaveLength(2);
  });
});

describe('senderList', () => {
  it('shows the recent ones of that kind first, then the rest, each once', () => {
    const recent = [
      { kind: 'manufacturer' as const, id: 9, name: 'Bosch' },
      { kind: 'supplier' as const, id: 4, name: 'FPS' },
    ];
    expect(senderList('supplier', SUPPLIERS, recent, '').map((s) => s.name)).toEqual(['FPS', 'APEC', 'BGA', 'Euro Car Parts']);
  });

  it('keeps a recent sender the list no longer has, so it still works without signal', () => {
    const recent = [{ kind: 'supplier' as const, id: 42, name: 'Old Supplier' }];
    expect(senderList('supplier', [], recent, '').map((s) => s.name)).toEqual(['Old Supplier']);
  });

  it('only searches once something is typed', () => {
    const recent = [{ kind: 'supplier' as const, id: 4, name: 'FPS' }];
    expect(senderList('supplier', SUPPLIERS, recent, 'bga').map((s) => s.name)).toEqual(['BGA']);
  });
});
