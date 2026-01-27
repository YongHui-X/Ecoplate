-- Users & Auth
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    user_location TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- MyFridge
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    quantity REAL NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'item',
    purchase_date INTEGER,
    expiry_date INTEGER,
    storage_location TEXT DEFAULT 'fridge',
    notes TEXT,
    image_url TEXT,
    barcode TEXT,
    is_consumed INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS receipt_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    raw_text TEXT,
    parsed_data TEXT,
    status TEXT DEFAULT 'pending',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS consumption_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    quantity REAL NOT NULL,
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Marketplace
CREATE TABLE IF NOT EXISTS marketplace_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    quantity REAL NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'item',
    price REAL,
    original_price REAL,
    expiry_date INTEGER,
    pickup_location TEXT,
    pickup_instructions TEXT,
    status TEXT DEFAULT 'active',
    reserved_by INTEGER REFERENCES users(id),
    reserved_at INTEGER,
    sold_at INTEGER,
    view_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS listing_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Gamification
CREATE TABLE IF NOT EXISTS user_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    total_points INTEGER DEFAULT 0,
    available_points INTEGER DEFAULT 0,
    lifetime_points INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date INTEGER,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS point_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    action TEXT NOT NULL,
    reference_type TEXT,
    reference_id INTEGER,
    description TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    category TEXT,
    points_awarded INTEGER DEFAULT 0,
    requirement TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS user_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    earned_at INTEGER NOT NULL DEFAULT (unixepoch()),
    notified_at INTEGER
);

CREATE TABLE IF NOT EXISTS user_sustainability_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    total_items_consumed INTEGER DEFAULT 0,
    total_items_wasted INTEGER DEFAULT 0,
    total_items_shared INTEGER DEFAULT 0,
    total_items_sold INTEGER DEFAULT 0,
    estimated_money_saved REAL DEFAULT 0,
    estimated_co2_saved REAL DEFAULT 0,
    waste_reduction_rate REAL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS daily_sustainability_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    items_consumed INTEGER DEFAULT 0,
    items_wasted INTEGER DEFAULT 0,
    items_shared INTEGER DEFAULT 0,
    items_sold INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_expiry_date ON products(expiry_date);
CREATE INDEX IF NOT EXISTS idx_listings_seller_id ON marketplace_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_messages_listing_id ON messages(listing_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON point_transactions(user_id);
