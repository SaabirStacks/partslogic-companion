import type { QueueItem } from '@/vendor/partslogic/shared/bin-session';

// Who a delivery came from: one of PartsLogic's suppliers, or a manufacturer (a catalogue brand) when the
// box comes direct. Chosen before the first scan, so every receipt reaches the office classified.
export type Sender = { kind: 'supplier' | 'manufacturer'; id: number; name: string };

export const SENDER_KINDS: readonly { kind: Sender['kind']; label: string }[] = [
  { kind: 'supplier', label: 'Supplier' },
  { kind: 'manufacturer', label: 'Manufacturer' },
];

// PartsLogic keeps a delivery note number of at most 60 characters.
export const REFERENCE_MAX = 60;

// The delivery note as PartsLogic stores it: trimmed, and nothing when it's blank.
export function cleanReference(text: string | null | undefined): string | null {
  const trimmed = (text ?? '').trim().slice(0, REFERENCE_MAX);
  return trimmed === '' ? null : trimmed;
}

// The queued call that tells PartsLogic who a delivery is from. Null when there's nothing to say.
export function receiptDetails(
  clientId: string,
  documentId: string,
  sender: Sender | null,
  reference: string | null,
): Extract<QueueItem, { kind: 'receipt_details' }> | null {
  if (!sender && !reference) return null;
  return {
    kind: 'receipt_details',
    clientId,
    documentId,
    sourceId: sender?.kind === 'supplier' ? sender.id : null,
    brandId: sender?.kind === 'manufacturer' ? sender.id : null,
    reference,
  };
}

// "BGA", or "Delivery" for one started before senders were asked for.
export const deliveryName = (sender: Sender | null) => sender?.name ?? 'Delivery';

// A sender saved on the phone (JSON), read back safely: anything malformed reads as no sender.
export function readSender(value: string | null): Sender | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<Sender>;
    const kind = parsed.kind === 'supplier' || parsed.kind === 'manufacturer' ? parsed.kind : null;
    if (!kind || typeof parsed.id !== 'number' || typeof parsed.name !== 'string' || parsed.name === '') return null;
    return { kind, id: parsed.id, name: parsed.name };
  } catch {
    return null;
  }
}
