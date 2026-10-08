import type { Href } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';

import { CountStore } from '@/features/count/count-store';
import { DeliveryStore } from '@/features/receive/delivery-store';
import { clock, plural } from '@/lib/format';
import { visibleLines } from '@/vendor/partslogic/shared/bin-session';

// Work left open on this phone: a delivery still being received, a bin still being counted.
export type OpenWork =
  | { kind: 'delivery'; units: number; startedAt: string }
  | { kind: 'count'; bin: string; units: number; startedAt: string };

export async function readOpenWork(database: SQLiteDatabase, userId: string): Promise<OpenWork[]> {
  const deliveries = new DeliveryStore(database);
  const [delivery, count] = await Promise.all([deliveries.open(userId), new CountStore(database).open(userId)]);
  const work: OpenWork[] = [];
  if (delivery) {
    const lines = await deliveries.lines(delivery.documentId);
    work.push({ kind: 'delivery', units: lines.reduce((sum, line) => sum + line.qty, 0), startedAt: delivery.startedAt });
  }
  if (count) {
    const units = visibleLines(count.session).reduce((sum, line) => sum + line.qty, 0);
    work.push({ kind: 'count', bin: count.binCode, units, startedAt: count.startedAt });
  }
  return work;
}

// The resume plate's words: what's open, and how far it got.
export function resumeText(work: OpenWork): { title: string; detail: string; href: Href } {
  const detail = `${plural(work.units, 'unit', 'units')} · started ${clock(work.startedAt)}`;
  return work.kind === 'delivery'
    ? { title: 'Delivery', detail, href: '/receive' }
    : { title: `Bin ${work.bin}`, detail, href: '/count' };
}
