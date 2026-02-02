#!/bin/sh
# Initialize database: push schema and seed data

set -e

echo "Waiting for database to be ready..."
sleep 2

echo "Pushing database schema..."
npm run db:push

echo "Seeding database..."
npm run seed || echo "Database already seeded, skipping..."

echo "Database initialization complete!"

