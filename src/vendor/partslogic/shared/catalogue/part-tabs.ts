import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readNumber, readRecord, type JsonRecord } from '../core/read';
import type { PartKind } from '../inventory/items';
import type { ClaimState } from './part-detail';

export type PartAlternative = {
  partId: number;
  brand: string;
  number: string;
  kind: PartKind;
  relation: string;
  via: string | null;
  confidence: number;
  onHand: number;
  inRange: boolean;
  // For alternatives you stock: their best cost, retail price and margin.
  bestCost: number | null;
  sellPrice: number | null;
  margin: number | null;
};

export type PartFitment = {
  vehicleId: number;
  ktype: number | null;
  make: string;
  model: string;
  typeName: string | null;
  generation: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  engineCc: number | null;
  powerKw: number | null;
  fuel: string | null;
  state: ClaimState;
  confidence: number;
  matchMethod: string | null;
};

export type VehicleText = {
  fitmentId: number;
  text: string;
  qualifiers: JsonRecord;
  state: ClaimState;
  sources: number;
  matchedVehicles: number;
};

export type PartFact = {
  factId: number;
  field: string;
  value: Json;
  state: ClaimState;
  sources: number;
  evidence: number;
  firstSeen: string | null;
  lastSeen: string | null;
};

export type ClaimKind = 'fact' | 'link' | 'barcode' | 'fitment';

export type ClaimSource = {
  evidenceId: number | null;
  kind: 'evidence' | 'proposal';
  sourceId: number | null;
  source: string | null;
  sourceKind: string | null;
  batchId: string | null;
  fileName: string | null;
  rowNumber: number | null;
  manualBy: string | null;
  observedAt: string | null;
};

// Parts that can replace this one, with how much of each you hold. OE numbers are never alternatives.
export async function getPartAlternatives(supabase: Client, partId: number): Promise<PartAlternative[]> {
  const { data, error } = await supabase.rpc('part_alternatives_with_stock', { p_part: partId });
  if (error) throw dataError(error);

  return (data ?? []).flatMap((row) =>
    row.part_id == null || row.brand == null || row.number == null || row.kind == null || row.relation == null
      ? []
      : [
          {
            partId: row.part_id,
            brand: row.brand,
            number: row.number,
            kind: row.kind,
            relation: row.relation,
            via: row.via,
            confidence: readNumber(row.confidence) ?? 0,
            onHand: readNumber(row.on_hand) ?? 0,
            inRange: row.in_range ?? false,
            bestCost: readNumber(row.best_cost),
            sellPrice: readNumber(row.sell_price),
            margin: readNumber(row.margin),
          },
        ],
  );
}

// Vehicles the part fits, from the KType master.
export async function getPartFitments(supabase: Client, partId: number): Promise<PartFitment[]> {
  const { data, error } = await supabase.rpc('part_fitments_for', { p_part: partId });
  if (error) throw dataError(error);

  return (data ?? []).flatMap((row) =>
    row.vehicle_id == null || row.make == null || row.model == null || row.state == null
      ? []
      : [
          {
            vehicleId: row.vehicle_id,
            ktype: row.ktype,
            make: row.make,
            model: row.model,
            typeName: row.type_name,
            generation: row.generation,
            yearFrom: row.year_from,
            yearTo: row.year_to,
            engineCc: row.engine_cc,
            powerKw: readNumber(row.power_kw),
            fuel: row.fuel,
            state: row.state,
            confidence: readNumber(row.confidence) ?? 0,
            matchMethod: row.match_method,
          },
        ],
  );
}

// Vehicle lines as sources wrote them, with how many KType vehicles each matched.
export async function getPartVehicleTexts(supabase: Client, partId: number): Promise<VehicleText[]> {
  const { data, error } = await supabase.rpc('part_vehicle_texts', { p_part: partId });
  if (error) throw dataError(error);

  return (data ?? []).flatMap((row) =>
    row.fitment_id == null || row.vehicle_text == null || row.state == null
      ? []
      : [
          {
            fitmentId: row.fitment_id,
            text: row.vehicle_text,
            qualifiers: readRecord(row.qualifiers) ?? {},
            state: row.state,
            sources: row.sources ?? 0,
            matchedVehicles: row.matched_vehicles ?? 0,
          },
        ],
  );
}

// Every fact about the part with its claim state and how many sources state it.
export async function getPartSpecs(supabase: Client, partId: number): Promise<PartFact[]> {
  const { data, error } = await supabase.rpc('part_specs', { p_part: partId });
  if (error) throw dataError(error);

  return (data ?? []).flatMap((row) =>
    row.fact_id == null || row.field == null || row.state == null
      ? []
      : [
          {
            factId: row.fact_id,
            field: row.field,
            value: row.value,
            state: row.state,
            sources: row.sources ?? 0,
            evidence: row.evidence ?? 0,
            firstSeen: row.first_seen,
            lastSeen: row.last_seen,
          },
        ],
  );
}

// Where a claim came from: the file and row of each piece of evidence, or the person who stated it.
export async function getClaimSources(supabase: Client, kind: ClaimKind, id: number): Promise<ClaimSource[]> {
  const { data, error } = await supabase.rpc('claim_sources', { p_kind: kind, p_id: id });
  if (error) throw dataError(error);

  return (data ?? []).map((row) => ({
    evidenceId: row.evidence_id,
    kind: row.kind === 'proposal' ? 'proposal' : 'evidence',
    sourceId: row.source_id,
    source: row.source,
    sourceKind: row.source_kind,
    batchId: row.batch_id,
    fileName: row.file_name,
    rowNumber: row.row_number,
    manualBy: row.manual_by,
    observedAt: row.observed_at,
  }));
}
