import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { MIGRATIONS } from './migrations';

function migrate(db: SQLiteDatabase) {
  const current = db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version++) {
    db.withTransactionSync(() => {
      db.execSync(MIGRATIONS[version]);
      db.execSync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

// One database for the app, opened and brought up to date on first use.
let database: SQLiteDatabase | null = null;

export function db(): SQLiteDatabase {
  if (!database) {
    database = openDatabaseSync('partslogic.db');
    // WAL lets the runner write while screens read. It can't be set inside a transaction.
    database.execSync(`PRAGMA journal_mode = 'wal'`);
    migrate(database);
  }
  return database;
}
