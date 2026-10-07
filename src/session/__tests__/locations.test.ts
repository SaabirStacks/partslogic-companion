import { resolveWorkingLocation, workingLocations } from '../locations';

const main = { id: 1, code: 'MAIN', name: 'Main warehouse' };
const shop = { id: 2, code: 'SHOP', name: 'Trade counter' };

describe('workingLocations', () => {
  it('leaves out the Unassigned pseudo-location', () => {
    expect(
      workingLocations([
        { id: 0, code: 'UNASSIGNED', name: 'Unassigned', bins: [] },
        { ...main, bins: [] },
      ]),
    ).toEqual([main]);
  });
});

describe('resolveWorkingLocation', () => {
  it('keeps the saved location, refreshed from the list', () => {
    expect(resolveWorkingLocation({ ...main, name: 'Old name' }, [main, shop])).toEqual(main);
  });

  it('picks the only location when there is one', () => {
    expect(resolveWorkingLocation(null, [main])).toEqual(main);
  });

  it('asks when there are several and none is saved, or the saved one is gone', () => {
    expect(resolveWorkingLocation(null, [main, shop])).toBeNull();
    expect(resolveWorkingLocation({ id: 9, code: 'OLD', name: 'Closed' }, [main, shop])).toBeNull();
  });
});
