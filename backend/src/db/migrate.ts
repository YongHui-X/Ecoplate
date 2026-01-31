import { Database } from "bun:sqlite";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const dbPath = "ecoplate.db";
const migrationsDir = join(import.meta.dir, "migrations");

console.log("Running database migrations...\n");

try {
  const sqlite = new Database(dbPath);

  // Get all SQL migration files sorted by name
  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Found ${migrationFiles.length} migration files\n`);

  for (const file of migrationFiles) {
    console.log(`Running migration: ${file}`);
    const migrationPath = join(migrationsDir, file);
    const migration = readFileSync(migrationPath, "utf-8");

    // Split by statement breakpoint (for drizzle-generated migrations) or semicolon
    const statements = migration
      .split(/--> statement-breakpoint|;/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      try {
        sqlite.exec(statement + ";");
      } catch (e: unknown) {
        const err = e as { message?: string };
        // Ignore "table already exists" errors when using IF NOT EXISTS
        if (!err.message?.includes("already exists")) {
          throw e;
        }
      }
    }
    console.log(`  ✓ ${file} completed`);
  }

  sqlite.close();

  console.log("\n✓ All migrations completed successfully!");
  console.log("\nNext steps:");
  console.log("  1. Run: bun run db:seed");
  console.log("  2. Start server: bun run dev\n");
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
}
