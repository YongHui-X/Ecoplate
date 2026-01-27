-- Drop old fridge_products table
DROP TABLE IF EXISTS fridge_products;

-- Products (per ERD)
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    category TEXT,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL,
    purchase_date INTEGER,
    description TEXT,
    co2_emission REAL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
