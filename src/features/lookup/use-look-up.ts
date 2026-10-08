import { router } from 'expo-router';
import { useState } from 'react';

import { recentPartsPref, type RecentPart } from '@/lib/prefs';
import { supabase } from '@/lib/supabase';
import { scanFeedback } from '@/scan/feedback';
import { resolveCode } from '@/scan/resolve';
import { useWorkingLocation } from '@/session/location-provider';
import { classifyQueueError } from '@/vendor/partslogic/shared/errors';
import { searchParts, type PartSearchResult } from '@/vendor/partslogic/shared/catalogue';

import { addRecent } from './recent';

export type LookUpView =
  | { kind: 'idle' }
  | { kind: 'working'; code: string }
  | { kind: 'bin'; code: string; binId: number; bin: string; location: string }
  | { kind: 'unknown'; code: string }
  | { kind: 'results'; query: string; results: PartSearchResult[] }
  | { kind: 'offline'; code: string; typed: boolean }
  | { kind: 'error'; code: string; typed: boolean; message: string };

const isConnectionProblem = (error: unknown) => classifyQueueError(error as { code?: string; message?: string }) === 'retry';

// Everything the Look up tab does with a code: a part opens its card, a bin offers a count, anything
// else is searched (typed) or reported as unknown (scanned). The server decides; nothing is guessed.
export function useLookUp() {
  const { location } = useWorkingLocation();
  const [view, setView] = useState<LookUpView>({ kind: 'idle' });
  const [recent, setRecent] = useState<RecentPart[]>(() => recentPartsPref.get() ?? []);

  function openPart(part: RecentPart) {
    const next = addRecent(recent, part);
    recentPartsPref.set(next);
    setRecent(next);
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
        scanFeedback.found();
        setView({ kind: 'idle' });
        openPart({ partId: hit.partId, brand: hit.brand, number: hit.number, description: null });
      } else if (hit.type === 'bin') {
        scanFeedback.found();
        setView({ kind: 'bin', code, binId: hit.binId, bin: hit.bin, location: hit.location });
      } else if (hit.type === 'offline') {
        scanFeedback.failed();
        setView({ kind: 'offline', code, typed });
      } else if (typed) {
        await search(code);
      } else {
        scanFeedback.unknown();
        setView({ kind: 'unknown', code });
      }
    } catch (error) {
      scanFeedback.failed();
      setView({ kind: 'error', code, typed, message: (error as Error).message });
    }
  }

  return {
    view,
    recent,
    busy: view.kind === 'working',
    scan: (code: string) => void lookUp(code, false),
    type: (text: string) => void lookUp(text, true),
    search: (query: string) => void search(query),
    retry: (code: string, typed: boolean) => void lookUp(code, typed),
    openPart,
    clear: () => setView({ kind: 'idle' }),
  };
}
