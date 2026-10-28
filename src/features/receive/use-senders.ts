import { useCallback, useEffect, useMemo, useState } from 'react';

import { db } from '@/db/database';
import { SavedLists } from '@/db/saved-lists';
import { supabase } from '@/lib/supabase';
import { useDebounced } from '@/lib/use-debounced';
import { useRemote } from '@/lib/use-remote';
import { brandOptions } from '@/vendor/partslogic/shared/add-part';
import { listSupplierOptions } from '@/vendor/partslogic/shared/suppliers';

import type { Sender } from './sender';
import { rememberSender, senderList, type SenderOption } from './sender-options';

const SUPPLIERS = 'suppliers';
const RECENT = 'recent-senders';

// The suppliers from PartsLogic, saving a copy each time so the list still shows without signal (with
// when it was saved). Only a failure with no saved copy is an error.
async function loadSuppliers(saved: SavedLists): Promise<{ options: SenderOption[]; savedAt: string | null }> {
  try {
    const options: SenderOption[] = (await listSupplierOptions(supabase)).map((option) => ({
      kind: 'supplier',
      id: option.supplierId,
      name: option.name,
      detail: null,
    }));
    await saved.save(SUPPLIERS, options);
    return { options, savedAt: null };
  } catch (error) {
    const copy = await saved.read<SenderOption[]>(SUPPLIERS);
    if (copy) return { options: copy.value, savedAt: copy.savedAt };
    throw error;
  }
}

// Manufacturers are PartsLogic's brands, searched as you type (there are thousands).
async function loadManufacturers(query: string): Promise<SenderOption[]> {
  return (await brandOptions(supabase, query || null, 20)).map((brand) => ({
    kind: 'manufacturer',
    id: brand.brandId,
    name: brand.name,
    detail: brand.alias ? `Also ${brand.alias}` : null,
  }));
}

// What the Who's it from? list shows for a kind and what's typed, and remember() for a sender once a
// delivery starts with it.
export function useSenders(kind: Sender['kind'], query: string) {
  const saved = useMemo(() => new SavedLists(db()), []);
  const [recent, setRecent] = useState<Sender[]>([]);
  const settled = useDebounced(query.trim(), 250);

  useEffect(() => {
    let current = true;
    void saved.read<Sender[]>(RECENT).then((copy) => {
      if (current && copy) setRecent(copy.value);
    });
    return () => {
      current = false;
    };
  }, [saved]);

  const suppliers = useRemote(kind === 'supplier' ? SUPPLIERS : null, () => loadSuppliers(saved));
  const manufacturers = useRemote(kind === 'manufacturer' ? `brands:${settled}` : null, () => loadManufacturers(settled));
  const source = kind === 'supplier' ? suppliers : manufacturers;
  const options = kind === 'supplier' ? (suppliers.data?.options ?? []) : (manufacturers.data ?? []);

  const remember = useCallback(
    async (sender: Sender) => {
      const next = rememberSender(recent, sender);
      setRecent(next);
      await saved.save(RECENT, next);
    },
    [recent, saved],
  );

  return {
    // Brands are already searched on the server; suppliers are filtered here.
    options: senderList(kind, options, recent, kind === 'supplier' ? query : ''),
    loading: source.loading && options.length === 0,
    failed: source.error !== undefined,
    savedAt: kind === 'supplier' ? (suppliers.data?.savedAt ?? null) : null,
    reload: source.reload,
    remember,
  };
}
