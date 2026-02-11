#!/bin/sh
set -e

DB_PATH="${DATABASE_PATH:-/app/data/ecoplate.db}"

# Check if database exists
if [ -f "$DB_PATH" ]; then
    echo "[entrypoint] Database exists, preserving data..."
else
    echo "[entrypoint] No database found, will create new one..."
fi

# Run migrations (safe - only applies new changes)
echo "[entrypoint] Running database migrations..."
bun run src/db/migrate.ts

# Run seed (safe - skips if data exists, use --force to reset)
echo "[entrypoint] Running database seed..."
bun run src/db/seed.ts

echo "[entrypoint] Database initialization complete."

echo "[entrypoint] Starting server..."
exec bun run src/index.ts
