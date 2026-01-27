-- Fridge Products
CREATE TABLE IF NOT EXISTS fridge_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    quantity REAL NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'item',
    purchase_date INTEGER,
    expiry_date INTEGER,
    storage_location TEXT NOT NULL DEFAULT 'fridge',
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fridge_products_user_id ON fridge_products(user_id);
CREATE INDEX IF NOT EXISTS idx_fridge_products_expiry_date ON fridge_products(expiry_date);
