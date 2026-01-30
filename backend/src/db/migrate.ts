import { Database } from "bun:sqlite";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const dbPath = "ecoplate.db";
const migrationsDir = join(import.meta.dir, "migrations");
// List of migrations in order
const migrationFiles = [
  "0000_acoustic_the_hood.sql",
];

console.log("Running database migrations...\n");

try {
  const sqlite = new Database(dbPath);

  // Create migrations tracking table if not exists
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL
    )
  `);

  // Get applied migrations
  const appliedMigrations = new Set(
    sqlite.query("SELECT name FROM _migrations").all().map((r: any) => r.name)
  );

  let migrationsApplied = 0;

  for (const migrationName of migrationFiles) {
    if (appliedMigrations.has(migrationName)) {
      console.log(`✓ ${migrationName} (already applied)`);
      continue;
    }

    const migrationFile = join(migrationsDir, migrationName);
    if (!existsSync(migrationFile)) {
      console.error(`Migration file not found: ${migrationFile}`);
      continue;
    }

    console.log(`\nApplying ${migrationName}...`);
    const migration = readFileSync(migrationFile, "utf-8");

    // Split by statement breakpoint and execute each statement
    const statements = migration
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`  Found ${statements.length} statements`);

    for (let i = 0; i < statements.length; i++) {
      try {
        sqlite.exec(statements[i]);
        console.log(`  ✓ Statement ${i + 1}/${statements.length}`);
      } catch (err: any) {
        // Ignore "table already exists" or "column already exists" errors for idempotency
        if (err.message?.includes("already exists") || err.message?.includes("duplicate column")) {
          console.log(`  ⚠ Statement ${i + 1}/${statements.length} (skipped - already exists)`);
        } else {
          throw err;
        }
      }
    }

    // Record migration as applied
    sqlite.exec(`INSERT INTO _migrations (name, applied_at) VALUES ('${migrationName}', ${Date.now()})`);
    migrationsApplied++;
    console.log(`  ✓ ${migrationName} applied`);
  }

  sqlite.close();

  if (migrationsApplied > 0) {
    console.log(`\n✓ ${migrationsApplied} migration(s) completed successfully!`);
  } else {
    console.log("\n✓ Database is up to date!");
  }
  console.log("\nNext steps:");
  console.log("  1. Run: bun run db:seed");
  console.log("  2. Start server: bun run dev\n");
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
}
