#!/bin/sh
set -e

DB_PATH="${DATABASE_PATH:-/app/data/ecoplate.db}"

# Check if database needs initialization (users table missing)
NEEDS_INIT=false
if [ ! -f "$DB_PATH" ]; then
  echo "[entrypoint] Database file not found. Will initialize."
  NEEDS_INIT=true
else
  # Check if users table exists
  TABLE_EXISTS=$(bun -e "
    const { Database } = require('bun:sqlite');
    const db = new Database('$DB_PATH');
    try {
      db.query(\"SELECT name FROM sqlite_master WHERE type='table' AND name='users'\").get();
      const result = db.query(\"SELECT name FROM sqlite_master WHERE type='table' AND name='users'\").get();
      console.log(result ? 'yes' : 'no');
    } catch(e) { console.log('no'); }
    db.close();
  " 2>/dev/null || echo "no")

  if [ "$TABLE_EXISTS" != "yes" ]; then
    echo "[entrypoint] Database exists but tables are missing. Will initialize."
    NEEDS_INIT=true
  else
    echo "[entrypoint] Database already initialized. Skipping migration."
  fi
fi

if [ "$NEEDS_INIT" = "true" ]; then
  echo "[entrypoint] Running database migrations..."
  bun run src/db/migrate.ts
  echo "[entrypoint] Running database seed..."
  bun run src/db/seed.ts
  echo "[entrypoint] Database initialization complete."
fi

echo "[entrypoint] Starting server..."
exec bun run src/index.ts
