-- Pending Consumption Records (for "Do Later" feature in Track Consumption flow)
CREATE TABLE IF NOT EXISTS pending_consumption_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    raw_photo TEXT NOT NULL,
    ingredients TEXT NOT NULL,
    disposal_method TEXT NOT NULL DEFAULT 'landfill',
    status TEXT NOT NULL DEFAULT 'PENDING_WASTE_PHOTO',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_pending_consumption_user_id ON pending_consumption_records(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_consumption_status ON pending_consumption_records(status);
