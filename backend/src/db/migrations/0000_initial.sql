-- Users
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

-- Marketplace Listings
CREATE TABLE IF NOT EXISTS marketplace_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

-- Listing Images
CREATE TABLE IF NOT EXISTS listing_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_listings_seller_id ON marketplace_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_listing_images_listing_id ON listing_images(listing_id);
