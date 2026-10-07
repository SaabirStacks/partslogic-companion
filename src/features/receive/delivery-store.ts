import type { SQLiteDatabase } from 'expo-sqlite';

import type { DeliveryLine } from './lines';

export type Delivery = {
  documentId: string;
  userId: string;
  locationId: number | null;
  locationName: string | null;
  startedAt: string;
  finishedAt: string | null;
};

type DeliveryRow = {
  document_id: string;
  user_id: string;
  location_id: number | null;
  location_name: string | null;
  started_at: string;
  finished_at: string | null;
};

const toDelivery = (row: DeliveryRow): Delivery => ({
  documentId: row.document_id,
  userId: row.user_id,
  locationId: row.location_id,
  locationName: row.location_name,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
});

// Deliveries and their scanned lines, kept on the phone so a half-received delivery survives the app
// closing. What PartsLogic made of each line is read from the outbox (lines.ts).
export class DeliveryStore {
  constructor(private readonly db: SQLiteDatabase) {}

  async open(userId: string): Promise<Delivery | null> {
    const row = await this.db.getFirstAsync<DeliveryRow>(
      'SELECT * FROM deliveries WHERE user_id = ? AND finished_at IS NULL ORDER BY started_at DESC LIMIT 1',
      userId,
    );
    return row ? toDelivery(row) : null;
  }

  async recent(userId: string, limit = 10): Promise<Delivery[]> {
    const rows = await this.db.getAllAsync<DeliveryRow>(
      'SELECT * FROM deliveries WHERE user_id = ? AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT ?',
      userId,
      limit,
    );
    return rows.map(toDelivery);
  }

  async start(delivery: Delivery): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO deliveries (document_id, user_id, location_id, location_name, started_at) VALUES (?, ?, ?, ?, ?)',
      delivery.documentId,
      delivery.userId,
      delivery.locationId,
      delivery.locationName,
      delivery.startedAt,
    );
  }

  async addLine(documentId: string, line: DeliveryLine): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO delivery_lines (client_line_id, document_id, code, qty, label, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      line.clientLineId,
      documentId,
      line.code,
      line.qty,
      line.label,
      line.createdAt,
    );
  }

  async lines(documentId: string): Promise<DeliveryLine[]> {
    const rows = await this.db.getAllAsync<{
      client_line_id: string;
      code: string;
      qty: number;
      label: string | null;
      created_at: string;
    }>('SELECT * FROM delivery_lines WHERE document_id = ? ORDER BY seq', documentId);
    return rows.map((row) => ({
      clientLineId: row.client_line_id,
      code: row.code,
      qty: row.qty,
      label: row.label,
      createdAt: row.created_at,
    }));
  }

  async finish(documentId: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE deliveries SET finished_at = ? WHERE document_id = ?',
      new Date().toISOString(),
      documentId,
    );
  }
}
