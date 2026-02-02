#!/usr/bin/env node
// Wait for database to be ready before proceeding

import { Pool } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function waitForDb() {
  const maxAttempts = 30;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      await pool.query("SELECT 1");
      console.log("✅ Database is ready!");
      await pool.end();
      process.exit(0);
    } catch (error) {
      attempts++;
      if (attempts >= maxAttempts) {
        console.error("❌ Database connection failed after", maxAttempts, "attempts");
        await pool.end();
        process.exit(1);
      }
      console.log(`⏳ Waiting for database... (${attempts}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

waitForDb();

