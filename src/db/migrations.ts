// The phone's database schema, one step per version (PRAGMA user_version), as in the expo-sqlite docs.
// Never edit a step once released; add the next one.
export const MIGRATIONS: string[] = [
  // 1: the outbox, the offline scan list and saved part cards.
  `
  CREATE TABLE outbox (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    stream_key TEXT NOT NULL,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    label TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    result TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX outbox_user_status ON outbox (user_id, status, seq);
  CREATE INDEX outbox_stream ON outbox (stream_key, seq);
  CREATE TABLE scan_codes (code_key TEXT PRIMARY KEY NOT NULL, entries TEXT NOT NULL) WITHOUT ROWID;
  CREATE TABLE scan_codes_next (code_key TEXT PRIMARY KEY NOT NULL, entries TEXT NOT NULL) WITHOUT ROWID;
  CREATE TABLE part_cache (part_id INTEGER PRIMARY KEY NOT NULL, detail TEXT NOT NULL, cached_at TEXT NOT NULL);
  `,
  // 2: deliveries being received, and every line scanned into them (append-only, like the server).
  `
  CREATE TABLE deliveries (
    document_id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    location_id INTEGER,
    location_name TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT
  );
  CREATE TABLE delivery_lines (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    client_line_id TEXT NOT NULL UNIQUE,
    document_id TEXT NOT NULL,
    code TEXT NOT NULL,
    qty REAL NOT NULL,
    label TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX delivery_lines_document ON delivery_lines (document_id, seq);
  `,
  // 3: bin counts in progress or finished on this phone. session is the vendored BinSession (running
  // totals per scanned code); labels maps a code to the part name shown for it.
  `
  CREATE TABLE bin_counts (
    stocktake_id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    bin_id INTEGER NOT NULL,
    bin_code TEXT NOT NULL,
    location TEXT,
    started_at TEXT NOT NULL,
    session TEXT NOT NULL,
    labels TEXT NOT NULL DEFAULT '{}',
    finished_at TEXT,
    discarded INTEGER NOT NULL DEFAULT 0
  );
  `,
];
