import { normalisePartNumber } from '../normalise';

describe('normalisePartNumber', () => {
  it.each([
    ['W 712/75', 'W71275'],
    ['w712-75', 'W71275'],
    ['0 986 494 104', '0986494104'],
    ['  bosch.0986  ', 'BOSCH0986'],
  ])('keys %p as %p, like the database', (input, expected) => {
    expect(normalisePartNumber(input)).toBe(expected);
  });

  it.each([[''], ['   '], ['/-.'], [null], [undefined]])('returns null for %p', (input) => {
    expect(normalisePartNumber(input)).toBeNull();
  });
});
