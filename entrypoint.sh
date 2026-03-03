#!/bin/sh
set -e

DB_PATH="${DATABASE_PATH:-/app/data/ecoplate.db}"

# Always reset database on deployment (fresh migrate + seed)
echo "[entrypoint] Resetting database..."
rm -f "$DB_PATH"

echo "[entrypoint] Running database migrations..."
bun run src/db/migrate.ts

echo "[entrypoint] Running database seed..."
bun run src/db/seed.ts

echo "[entrypoint] Database initialization complete."

echo "[entrypoint] Starting server..."
exec bun run src/index.ts
