import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const dbPath = process.env.DATABASE_PATH || "ecoplate.db";
const sqlite = new Database(dbPath);
sqlite.exec("PRAGMA journal_mode = WAL;");

export let db = drizzle(sqlite, { schema });

/** Override the db instance (for testing only) */
export function __setTestDb(testDb: typeof db) {
  db = testDb;
}
