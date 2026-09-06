import { defineConfig } from "drizzle-kit";
import { requireDatabaseUrl } from "./scripts/load-env";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: requireDatabaseUrl(),
  },
});
