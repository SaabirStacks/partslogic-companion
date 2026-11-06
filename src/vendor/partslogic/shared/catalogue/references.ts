import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString, readStrings, type JsonRecord } from '../core/read';
import type { PartKind } from '../inventory/items';
import { CLAIM_STATES, readBarcode, type Barcode, type ClaimState } from './part-detail';

export type LinkedPart = {
  linkId: number;
  partId: number;
  brand: string;
  number: string;
  state: ClaimState;
  confidence: number;
};

export type OeReference = LinkedPart & {
  placeholder: boolean;
  sources: number;
  evidence: number;
  statedQuantity: number | null;
  basis: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
};

export type CrossReference = LinkedPart & { kind: PartKind; sources: number; inRange: boolean; onHand: number };

export type PartReferences = {
  oe: OeReference[];
  equivalentOe: (LinkedPart & { hubPartId: number })[];
  crossReferences: CrossReference[];
  supersessions: (LinkedPart & { relation: 'replaces' | 'superseded_by' })[];
  unattributed: { number: string; source: string | null; resolvedPartId: number | null }[];
  unattributedLabels: string[];
  barcodes: (Barcode & { evidence: number; firstSeen: string | null; lastSeen: string | null })[];
  aliases: { alias: string; kind: string; brand: string; source: string | null }[];
  labels: { code: string; type: string }[];
  identifiers: {
    tecdocAlias: string | null;
    autodocProductId: string | null;
    autodocUrl: string | null;
    external: { system: string; value: string }[];
  };
};

// The References tab: OE numbers, cross-references, supersessions, barcodes, aliases and outside ids.
export async function getPartReferences(supabase: Client, partId: number): Promise<PartReferences> {
  const { data, error } = await supabase.rpc('part_references', { p_part: partId });
  if (error) throw dataError(error);

  const refs = readRecord(data);
  const identifiers = readRecord(refs?.identifiers);
  const productId = identifiers?.autodoc_product_id;
  return {
    oe: readArray(refs?.oe).flatMap((value) => {
      const row = readRecord(value);
      const linked = readLinked(row);
      if (!linked) return [];
      return [
        {
          ...linked,
          placeholder: row?.placeholder === true,
          sources: readNumber(row?.sources) ?? 0,
          evidence: readNumber(row?.evidence) ?? 0,
          statedQuantity: readNumber(row?.stated_quantity),
          basis: readString(row?.basis),
          firstSeen: readString(row?.first_seen),
          lastSeen: readString(row?.last_seen),
        },
      ];
    }),
    // A link between two of this part's own OE numbers is returned once from each end, so the same
    // link arrives twice. Keep the first (rows are already ordered by make and number).
    equivalentOe: uniqueBy(
      readArray(refs?.equivalent_oe).flatMap((value) => {
        const row = readRecord(value);
        const linked = readLinked(row);
        const hubPartId = readNumber(row?.hub_part_id);
        return linked && hubPartId != null ? [{ ...linked, hubPartId }] : [];
      }),
      (item) => item.linkId
    ),
    crossReferences: readArray(refs?.cross_references).flatMap((value) => {
      const row = readRecord(value);
      const linked = readLinked(row);
      const kind = readString(row?.kind);
      if (!linked || !kind) return [];
      return [
        {
          ...linked,
          kind: kind as PartKind,
          sources: readNumber(row?.sources) ?? 0,
          inRange: readBoolean(row?.in_range) ?? false,
          onHand: readNumber(row?.on_hand) ?? 0,
        },
      ];
    }),
    supersessions: readArray(refs?.supersessions).flatMap((value) => {
      const row = readRecord(value);
      const linked = readLinked(row);
      const relation = readString(row?.relation);
      return linked && (relation === 'replaces' || relation === 'superseded_by') ? [{ ...linked, relation }] : [];
    }),
    unattributed: readArray(refs?.unattributed).flatMap((value) => {
      const row = readRecord(value);
      const number = readString(row?.number);
      return number
        ? [{ number, source: readString(row?.source), resolvedPartId: readNumber(row?.resolved_part_id) }]
        : [];
    }),
    unattributedLabels: readStrings(refs?.unattributed_labels),
    barcodes: readArray(refs?.barcodes).flatMap((value) => {
      const row = readRecord(value);
      return readBarcode(row).map((barcode) => ({
        ...barcode,
        evidence: readNumber(row?.evidence) ?? 0,
        firstSeen: readString(row?.first_seen),
        lastSeen: readString(row?.last_seen),
      }));
    }),
    aliases: readArray(refs?.aliases).flatMap((value) => {
      const row = readRecord(value);
      const alias = readString(row?.alias);
      const brand = readString(row?.brand);
      return alias && brand
        ? [{ alias, brand, kind: readString(row?.kind) ?? 'product_code', source: readString(row?.source) }]
        : [];
    }),
    labels: readArray(refs?.labels).flatMap((value) => {
      const row = readRecord(value);
      const code = readString(row?.code);
      return code ? [{ code, type: readString(row?.type) ?? 'internal' }] : [];
    }),
    identifiers: {
      tecdocAlias: readString(identifiers?.tecdoc_alias),
      autodocProductId: typeof productId === 'number' ? String(productId) : readString(productId),
      autodocUrl: readString(identifiers?.autodoc_url),
      external: readArray(identifiers?.external).flatMap((value) => {
        const row = readRecord(value);
        const system = readString(row?.system);
        const ref = readString(row?.value);
        return system && ref ? [{ system, value: ref }] : [];
      }),
    },
  };
}

// A curator confirms or rejects a link (OE number, cross-reference).
export async function reviewLink(supabase: Client, linkId: number, decision: 'verified' | 'rejected'): Promise<void> {
  const { error } = await supabase.rpc('review_link', { p_link: linkId, p_decision: decision });
  if (error) throw dataError(error);
}

function uniqueBy<T>(items: T[], key: (item: T) => number): T[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function readLinked(row: JsonRecord | null): LinkedPart | null {
  const linkId = readNumber(row?.link_id);
  const partId = readNumber(row?.part_id);
  const brand = readString(row?.brand);
  const number = readString(row?.number);
  const state = readString(row?.state);
  if (linkId == null || partId == null || !brand || !number || !state || !CLAIM_STATES.has(state)) return null;
  return { linkId, partId, brand, number, state: state as ClaimState, confidence: readNumber(row?.confidence) ?? 0 };
}
