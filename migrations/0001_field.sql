CREATE TABLE IF NOT EXISTS field_entries (
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
  sentry_status TEXT
);

CREATE INDEX IF NOT EXISTS idx_field_entries_home ON field_entries (home_id, created_at);

CREATE INDEX IF NOT EXISTS idx_field_entries_created ON field_entries (created_at);

CREATE TABLE IF NOT EXISTS field_photos (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  home_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  sort_index INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_field_photos_entry ON field_photos (entry_id, sort_index);
