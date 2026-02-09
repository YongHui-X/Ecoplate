import { Database } from "bun:sqlite";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

const dbPath = process.env.DATABASE_PATH || "ecoplate.db";
const sqlite = new Database(dbPath);

async function migrate() {
  console.log("Running database migrations...");

  const migrationsDir = join(import.meta.dir, "migrations");

  try {
    const files = await readdir(migrationsDir);
    const sqlFiles = files
        .filter((f) => f.endsWith(".sql"))
        .sort();

    console.log(`Found ${sqlFiles.length} migration files`);

    for (const file of sqlFiles) {
      console.log(`Running migration: ${file}`);
      const sqlPath = join(migrationsDir, file);
      const sql = await readFile(sqlPath, "utf-8");

      // Split by the statement-breakpoint marker
      const statements = sql
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter((s) => {
            // Filter out empty strings
            if (s.length === 0) return false;
            // Filter out blocks that are entirely comments (no actual SQL)
            const nonCommentLines = s.split('\n').filter(line => line.trim().length > 0 && !line.trim().startsWith('--'));
            if (nonCommentLines.length === 0) return false;
            // Filter out any TypeScript/JavaScript code (just in case)
            if (s.startsWith("import ") || s.startsWith("export ")) return false;
            return true;
          });

      for (const statement of statements) {
        try {
          // Remove any leading/trailing comments
          const cleanStatement = statement
              .split('\n')
              .filter(line => !line.trim().startsWith('--'))
              .join('\n')
              .trim();

          if (cleanStatement.length === 0) continue;

          // Only add semicolon if not already present
          const finalStatement = cleanStatement.endsWith(';')
              ? cleanStatement
              : cleanStatement + ";";

          sqlite.exec(finalStatement);
        } catch (error: any) {
          // Skip "already exists" errors for idempotent re-runs
          if (error.message?.includes('already exists')) {
            console.log(`  Skipped (already exists): ${statement.substring(0, 60).split('\n')[0]}...`);
            continue;
          }
          // Skip "duplicate column" errors from ALTER TABLE re-runs
          if (error.message?.includes('duplicate column')) {
            console.log(`  Skipped (column already exists): ${statement.substring(0, 60).split('\n')[0]}...`);
            continue;
          }
          console.error(`Error executing statement: ${statement.substring(0, 100)}...`);
          throw error;
        }
      }

      console.log(`✓ Completed migration: ${file}`);
    }

    console.log("All migrations completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    sqlite.close();
  }
}

migrate();