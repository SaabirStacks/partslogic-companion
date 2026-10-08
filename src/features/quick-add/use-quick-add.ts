import * as Crypto from 'expo-crypto';
import { useState } from 'react';

import { useOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';
import { useOutbox } from '@/queue/outbox-provider';
import { classifyQueueError, DataError } from '@/vendor/partslogic/shared/errors';
import { quickAddPart } from '@/vendor/partslogic/shared/floor';

import { addedMessage, conflictMessage } from './wording';

// The brand chosen from the list, or a name typed in (checked by PartsLogic, which may ask to confirm it).
export type BrandChoice = { brandId: number; name: string } | { brandId: null; name: string };

export type QuickAddOutcome =
  | { kind: 'added'; partId: number; message: string }
  | { kind: 'conflict'; message: string; holderId: number | null }
  | { kind: 'queued'; message: string }
  | { kind: 'confirm-brand'; message: string }
  | { kind: 'error'; message: string };

// Adds a part for a scanned code. With signal it asks PartsLogic straight away, so a conflict or a
// new-brand question is answered on the spot; without, the request waits in the outbox.
export function useQuickAdd(code: string) {
  const online = useOnline();
  const outbox = useOutbox();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<QuickAddOutcome | null>(null);

  async function queue(brand: BrandChoice, number: string, confirmNewBrand: boolean) {
    await outbox.enqueue(
      {
        kind: 'quick_add',
        clientId: Crypto.randomUUID(),
        brandId: brand.brandId ?? undefined,
        brandName: brand.brandId == null ? brand.name : undefined,
        number,
        code,
        confirmNewBrand,
      },
      `Add part ${brand.name} ${number}`,
    );
    setOutcome({
      kind: 'queued',
      message: `${brand.name} ${number} adds when you’re back online`,
    });
  }

  async function submit(brand: BrandChoice, number: string, confirmNewBrand = false) {
    const trimmed = number.trim();
    if (!brand.name.trim() || !trimmed) {
      setOutcome({ kind: 'error', message: 'Choose the brand and enter the part number.' });
      return;
    }
    setBusy(true);
    setOutcome(null);
    try {
      if (!online) {
        await queue(brand, trimmed, confirmNewBrand);
        return;
      }
      const result = await quickAddPart(supabase, {
        brandId: brand.brandId ?? undefined,
        brandName: brand.brandId == null ? brand.name.trim() : undefined,
        number: trimmed,
        code,
        confirmNewBrand,
      });
      setOutcome(
        result.status === 'added'
          ? { kind: 'added', partId: result.partId, message: addedMessage(result, brand.name, trimmed) }
          : { kind: 'conflict', message: conflictMessage(result), holderId: result.holder?.partId ?? null },
      );
    } catch (error) {
      if (error instanceof DataError && error.hint === 'confirm_new_brand') {
        setOutcome({ kind: 'confirm-brand', message: error.message });
      } else if (classifyQueueError(error as { code?: string; message?: string }) === 'retry') {
        await queue(brand, trimmed, confirmNewBrand);
      } else {
        setOutcome({ kind: 'error', message: (error as Error).message });
      }
    } finally {
      setBusy(false);
    }
  }

  return { online, busy, outcome, submit, reset: () => setOutcome(null) };
}

