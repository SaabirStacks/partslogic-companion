import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readNumber, readRecord, readString, type JsonRecord } from '../core/read';

export type EnrichmentBudget = {
  limit: number | null;
  // Spend counts from here; null means since the first call.
  periodStart: string | null;
  spent: number;
  allTime: number;
  charged: number;
  refunded: number;
  updatedAt: string | null;
};

export type EnrichmentRunSummary = {
  targetId: number;
  partId: number;
  brand: string;
  number: string;
  status: string;
  credits: number;
  lastError: string | null;
  productUrl: string | null;
  updatedAt: string;
};

export type EnrichmentProvider = 'piloterr' | 'firecrawl';

export async function getEnrichmentBudget(
  supabase: Client,
  provider: EnrichmentProvider = 'piloterr',
): Promise<EnrichmentBudget | null> {
  const { data, error } = await supabase.rpc('enrichment_budget', { p_provider: provider });
  if (error) throw dataError(error);
  const record = readRecord(data);
  if (!record) return null;
  return {
    limit: readNumber(record.limit),
    periodStart: readString(record.period_start),
    spent: readNumber(record.spent) ?? 0,
    allTime: readNumber(record.all_time) ?? readNumber(record.spent) ?? 0,
    charged: readNumber(record.charged) ?? 0,
    refunded: readNumber(record.refunded) ?? 0,
    updatedAt: readString(record.updated_at),
  };
}

// Starts a new budget period now: spend counts from zero again (admins). The ledger keeps every call.
export async function resetEnrichmentBudgetPeriod(supabase: Client, provider: EnrichmentProvider = 'piloterr'): Promise<void> {
  const { error } = await supabase.rpc('reset_api_budget_period', { p_provider: provider });
  if (error) throw dataError(error);
}

export async function listEnrichmentRuns(supabase: Client, limit = 50): Promise<EnrichmentRunSummary[]> {
  const { data, error } = await supabase.rpc('enrichment_activity', { p_limit: limit });
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row) =>
    row.target_id == null || row.part_id == null || row.brand == null || row.number == null || row.status == null || row.updated_at == null
      ? []
      : [
          {
            targetId: row.target_id,
            partId: row.part_id,
            brand: row.brand,
            number: row.number,
            status: row.status,
            credits: readNumber(row.credits) ?? 0,
            lastError: row.last_error,
            productUrl: row.product_url,
            updatedAt: row.updated_at,
          },
        ],
  );
}

// Sets a provider's credit budget (admins; Piloterr unless named). Spend is checked against it before every
// paid call.
export async function setEnrichmentBudget(
  supabase: Client,
  credits: number,
  provider: 'piloterr' | 'firecrawl' = 'piloterr',
): Promise<void> {
  const { error } = await supabase.rpc('set_api_budget', { p_provider: provider, p_credit_limit: credits });
  if (error) throw dataError(error);
}
