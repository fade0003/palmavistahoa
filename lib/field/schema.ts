// Idempotent field-notes schema. Pages runs these statements on first use.
// migrations/0001_field.sql is the same SQL for operators.

export const FIELD_SCHEMA: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS field_entries (
    id TEXT PRIMARY KEY,
    home_id TEXT NOT NULL,
    address TEXT NOT NULL,
    kind TEXT NOT NULL,
    violation_key TEXT,
    disposition TEXT,
    category TEXT,
    note TEXT NOT NULL DEFAULT '',
    lat REAL,
    lon REAL,
    author_email TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sentry_date TEXT,
    sentry_code TEXT,
    sentry_description TEXT,
    sentry_status TEXT,
    report_status TEXT,
    sent_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_field_entries_home ON field_entries (home_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_field_entries_created ON field_entries (created_at)`,
  `CREATE TABLE IF NOT EXISTS field_photos (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    home_id TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    content_type TEXT NOT NULL,
    byte_size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    sort_index INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_field_photos_entry ON field_photos (entry_id, sort_index)`,
];

export function fieldSchemaSql(): string {
  return `${FIELD_SCHEMA.join(";\n\n")};\n`;
}

// Columns added after the first field databases were created.
// CREATE TABLE IF NOT EXISTS does not alter an existing table.
export function reportStatusMigrations(existingColumns: readonly string[]): string[] {
  const have = new Set(existingColumns);
  const sql: string[] = [];
  if (!have.has("report_status")) sql.push("ALTER TABLE field_entries ADD COLUMN report_status TEXT");
  if (!have.has("sent_at")) sql.push("ALTER TABLE field_entries ADD COLUMN sent_at TEXT");
  sql.push("UPDATE field_entries SET report_status = 'pending' WHERE report_status IS NULL");
  sql.push("CREATE INDEX IF NOT EXISTS idx_field_entries_report ON field_entries (report_status, created_at)");
  return sql;
}

export function reportStatusMigrationSql(existingColumns: readonly string[]): string {
  return `${reportStatusMigrations(existingColumns).join(";\n\n")};\n`;
}
