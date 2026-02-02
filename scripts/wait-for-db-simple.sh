#!/bin/sh
# Simple wait script using pg_isready

set -e

host="${POSTGRES_HOST:-postgres}"
port="${POSTGRES_PORT:-5432}"
user="${POSTGRES_USER:-pizzapilot}"
db="${POSTGRES_DB:-pizzapilot}"

max_attempts=30
attempt=0

echo "Waiting for database to be ready..."

while [ $attempt -lt $max_attempts ]; do
  if PGPASSWORD="${POSTGRES_PASSWORD:-pizzapilot_dev}" pg_isready -h "$host" -p "$port" -U "$user" -d "$db" > /dev/null 2>&1; then
    echo "✅ Database is ready!"
    exit 0
  fi
  
  attempt=$((attempt + 1))
  echo "⏳ Waiting for database... ($attempt/$max_attempts)"
  sleep 1
done

echo "❌ Database connection failed after $max_attempts attempts"
exit 1
