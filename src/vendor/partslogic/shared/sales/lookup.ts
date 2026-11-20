import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readNumber, readRecord, readString } from '../core/read';

// Registration lookup (docs/SALES.md, section 10). A new plate on an enquiry is looked up by the vrm-lookup Edge
// Function, which holds the provider's key. The database scores what the provider said against our vehicle list:
// a clear leader is chosen, otherwise a person picks from the candidates. A plate matched once is remembered and
// never paid for again.

// remembered: matched before, no lookup made. matched: looked up and one vehicle clearly led. candidates: looked up,
// a person picks. not_found: the provider does not know the plate. failed: the provider could not be reached.
// off: no provider is set up.
export const PLATE_LOOKUP_STATES = ['remembered', 'matched', 'candidates', 'not_found', 'failed', 'off'] as const;
export type PlateLookupState = (typeof PLATE_LOOKUP_STATES)[number];

export type VehicleCandidate = { vehicleId: number; label: string; score: number };

export type PlateLookup = {
  state: PlateLookupState;
  vehicleId: number | null;
  label: string | null;
  // What the provider said in a few words ("Lexus GS450h SE-L Auto 2008"), for a plate nobody has matched yet.
  described: string | null;
  vin: string | null;
  candidates: VehicleCandidate[];
};

function readCandidates(value: Json | undefined): VehicleCandidate[] {
  return readArray(value).flatMap((item) => {
    const row = readRecord(item);
    const vehicleId = readNumber(row?.vehicle_id);
    if (!row || vehicleId == null) return [];
    return [{ vehicleId, label: readString(row.label) ?? '', score: readNumber(row.score) ?? 0 }];
  });
}

export function readPlateLookup(data: unknown): PlateLookup {
  const body = readRecord(data as Json) ?? {};
  const state = readString(body.state);
  return {
    state: (PLATE_LOOKUP_STATES as readonly string[]).includes(state ?? '') ? (state as PlateLookupState) : 'failed',
    vehicleId: readNumber(body.vehicle_id),
    label: readString(body.label),
    described: readString(body.described),
    vin: readString(body.vin),
    candidates: readCandidates(body.candidates),
  };
}

// Asks for a plate's vehicle. Never throws for trouble with the provider or the function: a lookup that fails is a
// plate still to be matched by hand, not an error on the enquiry.
export async function lookUpRegistration(supabase: Client, registration: string): Promise<PlateLookup> {
  const { data, error } = await supabase.functions.invoke<unknown>('vrm-lookup', { body: { registration } });
  return readPlateLookup(error ? { state: 'failed' } : data);
}

// The candidates for a plate looked up in the last day and not yet matched, best first. Empty when there is none.
export function plateCandidates(supabase: Client, registration: string): Promise<VehicleCandidate[]> {
  return call(supabase.rpc('vrm_candidates', { p_vrm: registration }), readCandidates);
}
