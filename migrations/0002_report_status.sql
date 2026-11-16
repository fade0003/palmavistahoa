-- Upgrade field_entries created before report status existed.
-- The Pages Function applies these only when the columns are missing.
-- Running ADD COLUMN twice fails, so do not re-run this file after the columns exist.

ALTER TABLE field_entries ADD COLUMN report_status TEXT;

ALTER TABLE field_entries ADD COLUMN sent_at TEXT;

UPDATE field_entries SET report_status = 'pending' WHERE report_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_field_entries_report ON field_entries (report_status, created_at);
