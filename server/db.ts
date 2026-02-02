import { drizzle } from "drizzle-orm/node-postgres";
import { neon, neonConfig } from "@neondatabase/serverless";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use Neon serverless for Cloudflare Workers/Pages Functions
// Use regular Pool for Node.js environments (Docker, local dev)
// Check for Cloudflare environment via USE_NEON env var or runtime detection
const useNeon = process.env.USE_NEON === "true" || 
                (typeof globalThis !== "undefined" && 
                 typeof (globalThis as any).caches !== "undefined");

let db: ReturnType<typeof drizzle>;

if (useNeon) {
  // Cloudflare Workers/Pages Functions environment - use Neon serverless
  neonConfig.fetchConnectionCache = true;
  const sql = neon(process.env.DATABASE_URL);
  db = drizzle({ client: sql, schema });
} else {
  // Node.js environment (development, Docker, etc.) - use Pool
  // Lazy import to avoid bundling pg in Cloudflare
  const pgModule = require("pg");
  const { Pool } = pgModule;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
}

export { db };
