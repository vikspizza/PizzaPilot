import { readFileSync } from "node:fs";
import pg from "pg";

function loadDevVars() {
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
    // optional
  }
}

const MEDIA_BASE = "https://media.vikspizza.com";

function mediaUrl(filename: string): string {
  return `${MEDIA_BASE}/${filename}`;
}

function filenameFromExistingUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith(MEDIA_BASE + "/")) {
    return url.slice(MEDIA_BASE.length + 1);
  }
  const match = url.match(/\/([^/?#]+)$/);
  return match?.[1] ?? null;
}

async function main() {
  loadDevVars();
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const { rows } = await client.query<{
      id: string;
      name: string;
      image_url: string | null;
    }>("SELECT id, name, image_url FROM pizzas ORDER BY name");

    console.log(`Found ${rows.length} pizzas\n`);

    for (const pizza of rows) {
      const filename = filenameFromExistingUrl(pizza.image_url);

      if (!filename) {
        console.log(`SKIP  ${pizza.name} — no image filename`);
        continue;
      }

      const nextUrl = mediaUrl(filename);
      if (pizza.image_url === nextUrl) {
        console.log(`OK    ${pizza.name} → ${nextUrl}`);
        continue;
      }

      await client.query("UPDATE pizzas SET image_url = $1 WHERE id = $2", [
        nextUrl,
        pizza.id,
      ]);
      console.log(`UPDATE ${pizza.name}`);
      console.log(`      ${pizza.image_url ?? "(null)"}`);
      console.log(`   →  ${nextUrl}`);
    }

    console.log("\nDone. Ensure these files exist in R2 bucket vikspizza-media.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
