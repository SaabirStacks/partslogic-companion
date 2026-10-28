import { DataError } from '@/vendor/partslogic/shared/errors';
import { setReceiptDetails } from '@/vendor/partslogic/shared/floor';

import { sendQueued } from '../handlers';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/vendor/partslogic/shared/floor', () => ({ setReceiptDetails: jest.fn() }));

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
