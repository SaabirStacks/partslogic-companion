import { useState } from 'react';

import { formatQty } from '@/features/part/stock';
import { deviceLabel } from '@/lib/device';
import { useOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { scanFeedback } from '@/scan/feedback';
import { resolveCode } from '@/scan/resolve';
import { useWorkingLocation } from '@/session/location-provider';
import { getPartDetail } from '@/vendor/partslogic/shared/catalogue';
import { transferStock } from '@/vendor/partslogic/shared/inventory';

import { moveProblem, outcomeUnknown } from './move-rules';

export type MoveBin = { binId: number; label: string };
export type MoveResult = { kind: 'moved' | 'unknown' | 'refused'; message: string };

// Moving stock of one part between bins, as a job: scan the part, choose the bin it comes from, scan (or
// choose) the bin it goes to, set how many, move. One camera serves every step: a part scan picks the
// part, a bin scan fills in "from" first and then "to". Online only, never queued (see move-rules.ts).
export function useMove(start: { partId: number | null; fromBinId: number | null }) {
  const online = useOnline();
  const { location } = useWorkingLocation();
  const [partId, setPartId] = useState<number | null>(start.partId);
  const [fromBinId, setFromBinId] = useState<number | null>(start.fromBinId);
  const [to, setTo] = useState<MoveBin | null>(null);
  const [qty, setQty] = useState(1);
  const [notice, setNotice] = useState<{ title: string; detail: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MoveResult | null>(null);

  // Read fresh, so "here" is the current quantity in each bin.
  const part = useRemote(partId !== null ? `move:${partId}` : null, () => getPartDetail(supabase, partId!));
  const detail = part.data ?? null;
  const stock = (detail?.item?.stock ?? []).filter((line) => line.qty > 0);
  const from = stock.find((line) => line.binId === fromBinId) ?? null;
  const available = from?.qty ?? 0;
  const name = detail ? `${detail.part.brand} ${detail.part.number}` : null;

  function choosePart(id: number) {
    setPartId(id);
    setFromBinId(null);
    setTo(null);
    setQty(1);
    setResult(null);
  }

  async function scan(code: string) {
    setNotice(null);
    try {
      const hit = await resolveCode(code, location);
      if (hit.type === 'part') {
        scanFeedback.found();
        choosePart(hit.partId);
      } else if (hit.type === 'bin') {
        if (partId === null) {
          scanFeedback.unknown();
          setNotice({ title: hit.bin, detail: 'Scan the part first' });
        } else if (fromBinId === null) {
          const holding = stock.find((line) => line.binId === hit.binId);
          if (holding) {
            scanFeedback.found();
            setFromBinId(hit.binId);
          } else {
            scanFeedback.unknown();
            setNotice({ title: hit.bin, detail: 'None of it here · choose the bin it’s in' });
          }
        } else if (hit.binId === fromBinId) {
          scanFeedback.unknown();
          setNotice({ title: hit.bin, detail: 'That’s where it’s coming from' });
        } else {
          scanFeedback.found();
          setTo({ binId: hit.binId, label: hit.bin });
        }
      } else {
        scanFeedback.unknown();
        setNotice({ title: code, detail: 'Not a part or bin we know' });
      }
    } catch (error) {
      scanFeedback.failed();
      setNotice({ title: code, detail: (error as Error).message });
    }
  }

  async function move() {
    if (partId === null || fromBinId === null || !to) return;
    setBusy(true);
    try {
      await transferStock(supabase, { fromBinId, toBinId: to.binId, partId, qty, reference: `Moved on ${deviceLabel()}` });
      scanFeedback.found();
      setResult({ kind: 'moved', message: `${formatQty(qty)} · ${from?.place} → ${to.label}` });
    } catch (error) {
      scanFeedback.failed();
      setResult(
        outcomeUnknown(error)
          ? { kind: 'unknown', message: 'No answer from PartsLogic · check the stock before trying again' }
          : { kind: 'refused', message: (error as Error).message },
      );
    } finally {
      setBusy(false);
    }
  }

  return {
    online,
    partId,
    name,
    detail,
    loading: part.loading,
    stock,
    from,
    to,
    qty,
    available,
    notice,
    busy,
    result,
    problem: fromBinId === null ? null : moveProblem({ fromBinId, toBinId: to?.binId ?? null, qty, available }),
    scan: (code: string) => void scan(code),
    chooseFrom: (binId: number) => {
      setFromBinId(binId);
      setTo(null);
      setQty(1);
    },
    chooseTo: setTo,
    clearTo: () => setTo(null),
    setQty: (value: number) => setQty(Math.max(0, value)),
    move: () => void move(),
    // After a move: keep the part, start again from choosing the bin.
    again: () => {
      setResult(null);
      setFromBinId(null);
      setTo(null);
      setQty(1);
      part.reload();
    },
  };
}
