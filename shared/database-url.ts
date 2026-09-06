/**
 * Resolve which Postgres URL to use.
 *
 * Local Wrangler (`.dev.vars`): set both `DATABASE_URL` (prod) and
 * `DEV_DATABASE_URL` (local/testing). Code prefers `DEV_DATABASE_URL`.
 *
 * Cloudflare Pages: set only the `DATABASE_URL` secret — never set
 * `DEV_DATABASE_URL` in production, or traffic would hit the wrong DB.
 *
 * Override: set `USE_PROD_DB=1` to force `DATABASE_URL` (e.g. rare prod migrations).
 */
export type DatabaseUrlEnv = {
  DATABASE_URL?: string;
  DEV_DATABASE_URL?: string;
  USE_PROD_DB?: string;
};

export function resolveDatabaseUrl(env: DatabaseUrlEnv): string | undefined {
  const useProd =
    env.USE_PROD_DB === "1" || env.USE_PROD_DB?.toLowerCase() === "true";
  const prod = env.DATABASE_URL?.trim();
  const dev = env.DEV_DATABASE_URL?.trim();

  if (useProd) {
    return prod || undefined;
  }
  return (dev || prod) || undefined;
}
