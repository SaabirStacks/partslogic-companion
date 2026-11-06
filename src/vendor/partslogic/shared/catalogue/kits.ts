import type { Json } from '@partslogic/db-types';

import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';
import type { ClaimState } from './part-detail';
import { readLinked, type LinkedPart } from './references';

export type KitLine = {
  linkId: number;
  partId: number;
  brand: string;
  number: string;
  name: string | null;
  qty: number;
  state: ClaimState;
  inRange: boolean;
  onHand: number;
};

export type PartKit = { components: KitLine[]; usedIn: KitLine[] };

// The Kit tab: the parts this kit is made of, and the kits this part belongs to.
export async function getPartKit(supabase: Client, partId: number): Promise<PartKit> {
  const { data, error } = await supabase.rpc('part_kit', { p_part: partId });
  if (error) throw dataError(error);

  const kit = readRecord(data);
  return { components: readKitLines(kit?.components), usedIn: readKitLines(kit?.used_in) };
}

// Adds a component to a kit (qty per kit). Returns the link id.
export async function addKitComponent(
  supabase: Client,
  input: { kitPartId: number; componentPartId: number; qty: number },
): Promise<number> {
  const { data, error } = await supabase.rpc('add_kit_component', {
    p_kit: input.kitPartId,
    p_component: input.componentPartId,
    p_qty: input.qty,
  });
  if (error) throw dataError(error);
  return data;
}

// Takes a component off a kit (the link is kept as rejected, with who removed it).
export async function removeKitComponent(supabase: Client, linkId: number): Promise<void> {
  const { error } = await supabase.rpc('remove_kit_component', { p_link: linkId });
  if (error) throw dataError(error);
}

function readKitLines(value: Json | undefined): KitLine[] {
  return readArray(value).flatMap((item) => {
    const row = readRecord(item);
    const linked = readLinked(row);
    if (!linked) return [];
    return [
      {
        linkId: linked.linkId,
        partId: linked.partId,
        brand: linked.brand,
        number: linked.number,
        name: readString(row?.name),
        qty: readNumber(row?.qty) ?? 1,
        state: linked.state,
        inRange: readBoolean(row?.in_range) ?? false,
        onHand: readNumber(row?.on_hand) ?? 0,
      },
    ];
  });
}
