// Cloudflare-specific database connection (edge-compatible)
// Uses Neon serverless driver which is designed for edge environments
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@shared/schema";

// In Cloudflare Workers, we need to get DATABASE_URL from env binding
// This function will be called from the function handler with the env
export function getDb(databaseUrl: string) {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  // Use Neon serverless for Cloudflare (edge-compatible)
  // neon() returns a fetch-compatible SQL function
  const sql = neon(databaseUrl);

  // Use drizzle-orm/neon-http adapter (designed for Neon serverless)
  return drizzle(sql, { schema });
}
