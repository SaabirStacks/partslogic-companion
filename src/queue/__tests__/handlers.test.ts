import { DataError } from '@/vendor/partslogic/shared/errors';
import { discardBinCount, setReceiptDetails } from '@/vendor/partslogic/shared/floor';

import { sendQueued } from '../handlers';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/vendor/partslogic/shared/floor', () => ({ setReceiptDetails: jest.fn(), discardBinCount: jest.fn() }));

const details = { kind: 'receipt_details', clientId: 'c', documentId: 'R1', sourceId: 7, brandId: null, reference: 'DN 1' } as const;
const send = jest.mocked(setReceiptDetails);

describe('sending who a delivery is from', () => {
  beforeEach(() => send.mockReset());

  it('sends the supplier and delivery note', async () => {
    send.mockResolvedValue({ documentId: 'R1', number: 'GR-0042', sourceId: 7, brandId: null, reference: 'DN 1' });
    await expect(sendQueued(details)).resolves.toMatchObject({ number: 'GR-0042' });
    expect(send).toHaveBeenCalledWith({}, { documentId: 'R1', sourceId: 7, brandId: null, reference: 'DN 1' });
  });

  it('records a refusal as the answer, so the delivery still finishes', async () => {
    send.mockRejectedValue(new DataError('Unknown supplier', 'P0002'));
    await expect(sendQueued(details)).resolves.toEqual({ refused: 'Unknown supplier' });
  });

  it('still waits for signal when the call could not get through', async () => {
    send.mockRejectedValue(new DataError('Network request failed', ''));
    await expect(sendQueued(details)).rejects.toThrow('Network request failed');
  });
});

describe('discarding a count in PartsLogic', () => {
  const discard = jest.mocked(discardBinCount);
  const item = { kind: 'discard_bin_count', clientId: 'c', stocktakeId: 'S1' } as const;
  beforeEach(() => discard.mockReset());

  it('asks PartsLogic to discard it', async () => {
    discard.mockResolvedValue({ stocktakeId: 'S1', discarded: true });
    await expect(sendQueued(item)).resolves.toEqual({ stocktakeId: 'S1', discarded: true });
    expect(discard).toHaveBeenCalledWith({}, 'S1');
  });

  it('is done, not stuck, while PartsLogic doesn’t have the discard yet (its clean-up cancels the count)', async () => {
    discard.mockRejectedValue(
      new DataError('Could not find the function public.discard_bin_count(p_stocktake) in the schema cache', 'PGRST202'),
    );
    await expect(sendQueued(item)).resolves.toEqual({ stocktakeId: 'S1', discarded: false });
  });

  it('still needs attention when PartsLogic refuses it, and waits when there’s no signal', async () => {
    discard.mockRejectedValue(new DataError('That count was already finished', '55000'));
    await expect(sendQueued(item)).rejects.toThrow('That count was already finished');
    discard.mockRejectedValue(new DataError('Network request failed', ''));
    await expect(sendQueued(item)).rejects.toThrow('Network request failed');
  });
});
