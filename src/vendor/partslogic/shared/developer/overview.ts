import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readBoolean, readNumber, readRecord } from '../core/read';

// The company's data at a glance (owners and developers): public.developer_overview. The parts catalogue's big tables
// are the database's estimates (catalogue.estimate), everything else is exact.

export type DeveloperOverview = {
  stock: { items: number; stocked: number; withStock: number; units: number; withPrice: number; stockCounts: number };
  catalogue: { estimate: boolean; parts: number; links: number; fitments: number; images: number; evidence: number };
  purchasing: {
    orders: number;
    ordersByStatus: Record<string, number>;
    receipts: number;
    bills: number;
    payments: number;
    returns: number;
    credits: number;
    cores: number;
  };
  suppliers: { total: number; active: number; withPrices: number; feedingCatalogue: number };
  customers: { accounts: number; active: number; retailCards: number };
  uploads: { sheets: number; rows: number };
  people: Record<string, number>;
  feedback: { new: number; up30d: number; down30d: number };
  canReset: boolean;
};

function counts(value: Json | undefined): Record<string, number> {
  const record = readRecord(value) ?? {};
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, n]) => {
      const number = readNumber(n);
      return number === null ? [] : [[key, number]];
    }),
  );
}

export function readDeveloperOverview(data: Json): DeveloperOverview {
  const record = readRecord(data) ?? {};
  const n = (section: Json | undefined, key: string) => readNumber(readRecord(section)?.[key]) ?? 0;
  return {
    stock: {
      items: n(record.stock, 'items'),
      stocked: n(record.stock, 'stocked'),
      withStock: n(record.stock, 'with_stock'),
      units: n(record.stock, 'units'),
      withPrice: n(record.stock, 'with_price'),
      stockCounts: n(record.stock, 'stock_counts'),
    },
    catalogue: {
      estimate: readBoolean(readRecord(record.catalogue)?.estimate) ?? true,
      parts: n(record.catalogue, 'parts'),
      links: n(record.catalogue, 'links'),
      fitments: n(record.catalogue, 'fitments'),
      images: n(record.catalogue, 'images'),
      evidence: n(record.catalogue, 'evidence'),
    },
    purchasing: {
      orders: n(record.purchasing, 'orders'),
      ordersByStatus: counts(readRecord(record.purchasing)?.orders_by_status),
      receipts: n(record.purchasing, 'receipts'),
      bills: n(record.purchasing, 'bills'),
      payments: n(record.purchasing, 'payments'),
      returns: n(record.purchasing, 'returns'),
      credits: n(record.purchasing, 'credits'),
      cores: n(record.purchasing, 'cores'),
    },
    suppliers: {
      total: n(record.suppliers, 'total'),
      active: n(record.suppliers, 'active'),
      withPrices: n(record.suppliers, 'with_prices'),
      feedingCatalogue: n(record.suppliers, 'feeding_catalogue'),
    },
    customers: {
      accounts: n(record.customers, 'accounts'),
      active: n(record.customers, 'active'),
      retailCards: n(record.customers, 'retail_cards'),
    },
    uploads: { sheets: n(record.uploads, 'sheets'), rows: n(record.uploads, 'rows') },
    people: counts(record.people),
    feedback: {
      new: n(record.feedback, 'new'),
      up30d: n(record.feedback, 'up_30d'),
      down30d: n(record.feedback, 'down_30d'),
    },
    canReset: readBoolean(record.can_reset) ?? false,
  };
}

export async function getDeveloperOverview(supabase: Client): Promise<DeveloperOverview> {
  return call(supabase.rpc('developer_overview'), readDeveloperOverview);
}
