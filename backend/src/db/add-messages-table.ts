import { Database } from "bun:sqlite";

const dbPath = "ecoplate.db";

console.log("Adding messages table...\n");

try {
  const sqlite = new Database(dbPath);

  // Check if messages table already exists
  const tableExists = sqlite.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='messages'"
  ).get();

  if (tableExists) {
    console.log("Messages table already exists. Skipping.");
  } else {
    sqlite.exec(`
      CREATE TABLE messages (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        listing_id integer NOT NULL,
        sender_id integer NOT NULL,
        receiver_id integer NOT NULL,
        content text NOT NULL,
        is_read integer DEFAULT false NOT NULL,
        created_at integer NOT NULL,
        FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
      );
    `);
    console.log("✓ Messages table created successfully!");
  }

  sqlite.close();
} catch (error) {
  console.error("Failed to add messages table:", error);
  process.exit(1);
}
