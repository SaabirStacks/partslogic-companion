import type { SQLiteDatabase } from 'expo-sqlite';

// The last copy of a pick list fetched from PartsLogic, kept so the list still shows without signal.
// Values are JSON; a list that fails to read back counts as never saved.
export class SavedLists {
  constructor(private readonly db: SQLiteDatabase) {}

  async read<T>(key: string): Promise<{ value: T; savedAt: string } | null> {
    const row = await this.db.getFirstAsync<{ value: string; saved_at: string }>('SELECT value, saved_at FROM saved_lists WHERE key = ?', key);
    if (!row) return null;
    try {
      return { value: JSON.parse(row.value) as T, savedAt: row.saved_at };
    } catch {
      return null;
    }
  }

  async save(key: string, value: unknown): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO saved_lists (key, value, saved_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, saved_at = excluded.saved_at',
      key,
      JSON.stringify(value),
      new Date().toISOString(),
    );
  }
}
