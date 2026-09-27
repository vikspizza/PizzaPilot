import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import type { SignupThrottleStage } from "@shared/schema";

type AppDatabase =
  | NeonHttpDatabase<typeof schema>
  | NodePgDatabase<typeof schema>
  | NodePgDatabase<Record<string, unknown>>;

export type SignupThrottleLogInput = {
  batchId: string;
  phone: string;
  stage: SignupThrottleStage;
  retryAfterSeconds: number;
};

export async function insertSignupThrottle(
  db: AppDatabase,
  entry: SignupThrottleLogInput,
): Promise<void> {
  await db.insert(schema.signupThrottle).values(entry);
}
