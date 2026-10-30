import { router } from 'expo-router';
import { useState } from 'react';

import { feel } from '@/feel/feel';
import { recentPartsPref, type RecentPart } from '@/lib/prefs';
import { supabase } from '@/lib/supabase';
import { resolveCode } from '@/scan/resolve';
import { useWorkingLocation } from '@/session/location-provider';
import { classifyQueueError } from '@/vendor/partslogic/shared/errors';
import { searchParts, type PartSearchResult } from '@/vendor/partslogic/shared/catalogue';

import { addRecent } from './recent';

export type LookUpView =
  | { kind: 'idle' }
  | { kind: 'working'; code: string }
  // A part, shown on the result card. at is when it was scanned, so scanning it again lands afresh.
  | { kind: 'part'; code: string; part: RecentPart; at: number }
  | { kind: 'bin'; code: string; binId: number; bin: string; location: string }
  | { kind: 'unknown'; code: string }
  | { kind: 'results'; query: string; results: PartSearchResult[] }
  | { kind: 'offline'; code: string; typed: boolean }
  | { kind: 'error'; code: string; typed: boolean; message: string };

const isConnectionProblem = (error: unknown) => classifyQueueError(error as { code?: string; message?: string }) === 'retry';

// Everything Look up does with a code: a part lands on the result card (tap it for the full part), a bin
// offers a count, anything else is searched (typed) or reported as unknown (scanned). The server decides;
// nothing is guessed.
export function useLookUp() {
  const { location } = useWorkingLocation();
  const [view, setView] = useState<LookUpView>({ kind: 'idle' });
  const [recent, setRecent] = useState<RecentPart[]>(() => recentPartsPref.get() ?? []);

  function remember(part: RecentPart) {
    const next = addRecent(recent, part);
    recentPartsPref.set(next);
    setRecent(next);
  }

  function openPart(part: RecentPart) {
    remember(part);
    router.push(`/part/${part.partId}`);
  }

  async function search(query: string) {
    setView({ kind: 'working', code: query });
    try {
      setView({ kind: 'results', query, results: await searchParts(supabase, query, 30) });
    } catch (error) {
      setView(
        isConnectionProblem(error)
          ? { kind: 'offline', code: query, typed: true }
          : { kind: 'error', code: query, typed: true, message: (error as Error).message },
      );
    }
  }

  async function lookUp(code: string, typed: boolean) {
    setView({ kind: 'working', code });
    try {
      const hit = await resolveCode(code, location);
      if (hit.type === 'part') {
        feel('scan');
        const part = { partId: hit.partId, brand: hit.brand, number: hit.number, description: null };
        remember(part);
        setView({ kind: 'part', code, part, at: Date.now() });
      } else if (hit.type === 'bin') {
        feel('scan');
        setView({ kind: 'bin', code, binId: hit.binId, bin: hit.bin, location: hit.location });
      } else if (hit.type === 'offline') {
        feel('refused');
        setView({ kind: 'offline', code, typed });
      } else if (typed) {
        await search(code);
      } else {
        feel('unknown');
        setView({ kind: 'unknown', code });
      }
    } catch (error) {
      feel('refused');
      setView({ kind: 'error', code, typed, message: (error as Error).message });
    }
  }

  return {
    view,
    recent,
    // An answer to a scan or typed code is on screen: the camera holds on it until Scan next. Search results
    // (and No match) leave it scanning.
    holding: view.kind !== 'idle' && view.kind !== 'results',
    scan: (code: string) => void lookUp(code, false),
    type: (text: string) => void lookUp(text, true),
    search: (query: string) => void search(query),
    retry: (code: string, typed: boolean) => void lookUp(code, typed),
    openPart,
    // A bin chosen from the list, shown as if its label had been scanned.
    showBin: (bin: { binId: number; code: string }) => {
      feel('scan');
      setView({ kind: 'bin', code: bin.code, binId: bin.binId, bin: bin.code, location: location?.code ?? '' });
    },
    clear: () => setView({ kind: 'idle' }),
  };
}
