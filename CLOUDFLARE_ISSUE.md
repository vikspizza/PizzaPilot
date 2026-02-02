# Cloudflare Pages Functions - Bundling Issue

## Current Issue

Wrangler is trying to bundle the `pg` package and its dependencies (`events`, `fs`, `dns`, etc.) which are Node.js built-in modules. These aren't available in Cloudflare Workers runtime.

## Root Cause

Even though we're using Neon serverless driver in Cloudflare, the bundler is statically analyzing imports and trying to bundle `pg` because:
1. `drizzle-orm/node-postgres` may reference `pg` internally
2. Our conditional imports still get analyzed by the bundler
3. `require("pg")` in `db.ts` gets bundled even if not executed

## Solutions

### Option 1: Use Drizzle's postgres-js adapter (Recommended)

Switch to `drizzle-orm/postgres-js` for Cloudflare, which uses `postgres-js` (edge-compatible) instead of `pg`:

```typescript
// server/db-cf.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

const sql = postgres(process.env.DATABASE_URL);
export const db = drizzle({ client: sql, schema });
```

**Pros:**
- `postgres-js` is designed for edge environments
- No Node.js built-in dependencies
- Works natively in Cloudflare Workers

**Cons:**
- Need to install `postgres` package
- Different API than `pg` (but Drizzle abstracts this)

### Option 2: Configure Wrangler to exclude pg

Add to `wrangler.toml`:
```toml
[build]
external = ["pg", "pg-pool", "pg-connection-string"]
```

**Note:** This may not work if Drizzle internally requires pg.

### Option 3: Use Cloudflare D1 (Alternative)

If Neon doesn't work, consider Cloudflare D1 (SQLite) for edge database.

## Recommended Next Steps

1. Install `postgres` package: `npm install postgres`
2. Update `server/db-cf.ts` to use `drizzle-orm/postgres-js`
3. Test with Wrangler: `npm run dev:cf`

This should resolve the bundling issues.

