import type { Client } from '../core/client';
import { dataError } from '../core/errors';
import type { PurchaseOrderDetail, PurchaseOrderLine } from './orders';

// What leaves PartsLogic with an order besides its PDF: a CSV of its lines (spreadsheets, portals that take a basket
// file) and the text for a portal's quick order box. The PDF itself is drawn in the web app
// (lib/documents/purchase-order-pdf.tsx) from the same purchase_order_detail.

export const ORDER_EXPORT_FORMATS = ['pdf', 'csv', 'portal'] as const;
export type OrderExportFormat = (typeof ORDER_EXPORT_FORMATS)[number];

export const ORDER_CSV_HEADERS = [
  'Their code',
  'Brand',
  'Part number',
  'Description',
  'Qty',
  'Unit',
  'Unit price',
  'Line total',
  'Exchange surcharge',
  'Reference',
] as const;

// One row per line, in ORDER_CSV_HEADERS' order. Prices are per unit, ex VAT, as plain numbers.
export function orderCsvRows(order: PurchaseOrderDetail): (string | number)[][] {
  return order.lines.map((line) => [
    line.supplierCode ?? '',
    line.brand,
    line.number,
    line.description ?? '',
    line.qty,
    line.unit ?? 'EA',
    line.unitCost,
    line.lineTotal,
    line.surcharge ?? '',
    line.reference ?? order.ourReference ?? '',
  ]);
}

// A portal's quick order box: their code and the quantity per line, tab-separated, with the line's reference when it
// has one. Lines without their code can't be pasted; they are listed for typing by hand.
export function portalText(order: PurchaseOrderDetail): { text: string; lines: number; withoutCode: PurchaseOrderLine[] } {
  const coded = order.lines.filter((line) => line.supplierCode);
  const text = coded
    .map((line) => [line.supplierCode, String(line.qty), line.reference ?? ''].filter((part, index) => index < 2 || part).join('\t'))
    .join('\n');
  return { text, lines: coded.length, withoutCode: order.lines.filter((line) => !line.supplierCode) };
}

// "PO-000014 Comline.pdf": the number and supplier, with nothing a file system or a mail program would choke on.
export function orderFileName(order: Pick<PurchaseOrderDetail, 'number' | 'supplier'>, extension: 'pdf' | 'csv'): string {
  const supplier = order.supplier.name.replace(/[^A-Za-z0-9 &.-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return `${order.number}${supplier ? ` ${supplier}` : ''}.${extension}`;
}

// Records in the order's history that it was printed or exported (once per person and format in ten minutes).
export async function recordPurchaseOrderExport(supabase: Client, orderId: string, format: OrderExportFormat): Promise<void> {
  const { error } = await supabase.rpc('record_purchase_order_export', { p_order: orderId, p_format: format });
  if (error) throw dataError(error);
}
