import { drizzle } from "drizzle-orm/node-postgres";
import { neon, neonConfig } from "@neondatabase/serverless";
import * as schema from "@shared/schema";
import { resolveDatabaseUrl } from "@shared/database-url";

const databaseUrl = resolveDatabaseUrl(process.env);
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL (or DEV_DATABASE_URL for local) must be set. Did you forget to provision a database?",
  );
}

// Use Neon serverless for Cloudflare Workers/Pages Functions
// Use regular Pool for Node.js environments (Express local dev)
// Check for Cloudflare environment via USE_NEON env var or runtime detection
const useNeon = process.env.USE_NEON === "true" || 
                (typeof globalThis !== "undefined" && 
                 typeof (globalThis as any).caches !== "undefined");

let db: ReturnType<typeof drizzle>;

if (useNeon) {
  // Cloudflare Workers/Pages Functions environment - use Neon serverless
  neonConfig.fetchConnectionCache = true;
  const sql = neon(databaseUrl);
  db = drizzle({ client: sql, schema });
} else {
  // Node.js environment (Express dev, etc.) - use Pool
  // Lazy import to avoid bundling pg in Cloudflare
  const pgModule = require("pg");
  const { Pool } = pgModule;
  const pool = new Pool({ connectionString: databaseUrl });
  db = drizzle({ client: pool, schema });
}

export { db };
