import { addedMessage, conflictMessage } from '../wording';

describe('quick add wording', () => {
  it('names the part that already holds the code', () => {
    expect(
      conflictMessage({
        status: 'conflict',
        conflict: 'barcode_held',
        code: '4006381333931',
        holder: { partId: 7, brand: 'MANN', number: 'W 712/75' },
      }),
    ).toBe('4006381333931 already belongs to MANN W 712/75, so nothing was added.');
  });

  it('says what was created and what was healed', () => {
    expect(
      addedMessage(
        { status: 'added', partId: 1, createdPart: true, createdBrand: false, wasInInventory: false, enrichSuggested: true, healed: 4 },
        'BOSCH',
        '0 986 494 104',
      ),
    ).toBe('Added BOSCH 0 986 494 104. It’s now in your range. 4 waiting scans were booked to it.');
  });
});
