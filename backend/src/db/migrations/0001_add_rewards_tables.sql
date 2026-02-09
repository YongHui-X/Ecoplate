CREATE TABLE IF NOT EXISTS rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT NOT NULL,
  points_cost INTEGER NOT NULL,
  stock INTEGER DEFAULT 0 NOT NULL,
  is_active INTEGER DEFAULT 1 NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  user_id INTEGER NOT NULL,
  reward_id INTEGER NOT NULL,
  points_spent INTEGER NOT NULL,
  redemption_code TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' NOT NULL,
  collected_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE
);
