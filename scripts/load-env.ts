import { readFileSync } from "node:fs";
import { resolveDatabaseUrl } from "../shared/database-url";

/** Load `.dev.vars` into process.env when keys are not already set. */
export function loadDevVars() {
  try {
    const content = readFileSync(".dev.vars", "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // optional when env is already set
  }
}

/** Prefer DEV_DATABASE_URL locally; force prod with USE_PROD_DB=1. */
export function requireDatabaseUrl(): string {
  loadDevVars();
  const url = resolveDatabaseUrl(process.env);
  if (!url) {
    throw new Error(
      "DATABASE_URL (or DEV_DATABASE_URL for local) must be set — see .dev.vars.example",
    );
  }
  return url;
}
