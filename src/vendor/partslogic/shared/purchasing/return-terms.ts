import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { DataError, dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';

// Return terms (docs/RETURNS_AND_CORES.md, section 8): for each reason, the days allowed from delivery, the handling
// charge taken off the credit, and whether the supplier's return number is needed first. The company has a set; a
// supplier has its own, in full, only where they differ. Every rule lives in SQL (public.return_terms,
// save_return_terms); this file shapes what is read and sent.

// The suppliers' own codes: the reasons a part is put on a return.
export const RETURN_REASONS = ['NR', 'WAR', 'DI', 'WS'] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

export function isReturnReason(value: unknown): value is ReturnReason {
  return typeof value === 'string' && (RETURN_REASONS as readonly string[]).includes(value);
}

// Every reason a return line can carry: the four, and CORE for an old unit (step 16), which goes on a return from
// Exchange cores, never as an ordinary line. Its terms' days allowed are how long a supplier gives us to send an old
// unit back.
export const RETURN_LINE_REASONS = [...RETURN_REASONS, 'CORE'] as const;
export type ReturnLineReason = (typeof RETURN_LINE_REASONS)[number];

export function isReturnLineReason(value: unknown): value is ReturnLineReason {
  return typeof value === 'string' && (RETURN_LINE_REASONS as readonly string[]).includes(value);
}

export type ReturnTermsValues = {
  // Null: no limit.
  windowDays: number | null;
  handlingPct: number;
  needsReturnNumber: boolean;
};

export type ReasonTerms = {
  reason: ReturnLineReason;
  label: string;
  description: string;
  company: ReturnTermsValues;
  // The supplier's own terms; null when it follows the company's (and always null for the company's own set).
  own: ReturnTermsValues | null;
};

export type ReturnTermsSet = { supplierId: number | null; terms: ReasonTerms[] };

// What a save sends, by reason: terms in full, or (for a supplier) null to follow the company's again.
export type ReturnTermsChanges = Partial<Record<ReturnLineReason, ReturnTermsValues | null>>;

// The terms that apply: the supplier's own, else the company's.
export function termsInForce(terms: ReasonTerms): ReturnTermsValues {
  return terms.own ?? terms.company;
}

function readValues(value: Json | undefined): ReturnTermsValues | null {
  const row = readRecord(value);
  if (!row) return null;
  return {
    windowDays: readNumber(row.window_days),
    handlingPct: readNumber(row.handling_pct) ?? 0,
    needsReturnNumber: readBoolean(row.needs_return_number) ?? false,
  };
}

export function readReturnTerms(data: Json): ReturnTermsSet {
  const row = readRecord(data);
  if (!row) throw new DataError('The return terms could not be read.', 'P0002');
  return {
    supplierId: readNumber(row.supplier_id),
    terms: readArray(row.terms).flatMap((item) => {
      const terms = readRecord(item);
      const reason = readString(terms?.reason);
      const company = readValues(terms?.company);
      if (!terms || !isReturnLineReason(reason) || !company) return [];
      return [
        {
          reason,
          label: readString(terms.label) ?? reason,
          description: readString(terms.description) ?? '',
          company,
          own: readValues(terms.own),
        },
      ];
    }),
  };
}

function valuesJson(values: ReturnTermsValues): Record<string, Json> {
  return {
    window_days: values.windowDays,
    handling_pct: values.handlingPct,
    needs_return_number: values.needsReturnNumber,
  };
}

// The company's terms (no supplier) or a supplier's.
export async function getReturnTerms(supabase: Client, supplierId: number | null = null): Promise<ReturnTermsSet> {
  const { data, error } = await supabase.rpc('return_terms', supplierId != null ? { p_source: supplierId } : {});
  if (error) throw dataError(error);
  return readReturnTerms(data);
}

export async function saveReturnTerms(
  supabase: Client,
  supplierId: number | null,
  changes: ReturnTermsChanges,
): Promise<ReturnTermsSet> {
  const p: Record<string, Json> = {};
  for (const reason of RETURN_LINE_REASONS) {
    const values = changes[reason];
    if (values === undefined) continue;
    p[reason] = values === null ? null : valuesJson(values);
  }
  // A null supplier is the company's terms: the argument has no default, so null is sent as it is.
  const { data, error } = await supabase.rpc('save_return_terms', { p_source: supplierId as number, p });
  if (error) throw dataError(error);
  return readReturnTerms(data);
}
