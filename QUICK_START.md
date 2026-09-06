# Quick Start Guide

## Run locally (Wrangler)

This project targets **Cloudflare Pages + Functions**. Local development uses Wrangler with a Neon database.

```bash
# 1. Install dependencies
npm install

# 2. Environment (one-time)
cp .dev.vars.example .dev.vars
# Edit .dev.vars:
#   DEV_DATABASE_URL  → your local/testing Neon DB (preferred for local)
#   DATABASE_URL      → production Neon DB (reference; used by Cloudflare)

# 3. Push schema to the *dev* DB (one-time or after schema changes)
#    db:push prefers DEV_DATABASE_URL when set in .dev.vars
npm run db:push
npm run seed   # optional

# 4. Build and run (also starts against DEV_DATABASE_URL)
npm run dev:cf
```

App runs at the URL Wrangler prints (often `http://localhost:8788`).

For Try a Pie holds, run the Durable Object worker in a second terminal:

```bash
npm run dev:holds
```

## Deploy to Cloudflare

```bash
# Git push (if Pages is connected to your repo)
git push origin main

# Or manual deploy
npm run deploy:cf
```

In Cloudflare Pages → Settings → Environment variables, set **`DATABASE_URL`** as a **Secret** (production Neon URL).  
Do **not** set `DEV_DATABASE_URL` in Cloudflare — if only `DATABASE_URL` is present, that value is used automatically.

## Database URL selection

| Context | Variable used |
|---------|----------------|
| Local Wrangler / `db:push` | `DEV_DATABASE_URL` if set, else `DATABASE_URL` |
| Cloudflare Pages (production) | `DATABASE_URL` secret only |

Both can live in `.dev.vars` for convenience; local code prefers `DEV_DATABASE_URL`.  
To force the production URL from a local script: `USE_PROD_DB=1`.

## Environment variables

| Where | File / place |
|-------|----------------|
| Local Wrangler | `.dev.vars` (gitignored) |
| Cloudflare Pages | Dashboard → Environment variables (Secret) |

Required locally: `DEV_DATABASE_URL` (or `DATABASE_URL`).  
Required in Cloudflare: `DATABASE_URL` (Neon connection string with `?sslmode=require`).

## Optional: Express dev server

For a Node/Express + Vite workflow (not Cloudflare runtime):

```bash
# Prefer loading from .dev.vars via your shell, or:
export DATABASE_URL="your-dev-neon-connection-string"
npm run dev
```

Use `http://localhost:5000`. Prefer `npm run dev:cf` when testing what runs on Pages.

## Troubleshooting

**Wrangler errors**

```bash
cat .dev.vars
rm -rf .wrangler
npm run build:cf && npm run dev:cf
```

**Database**

- Confirm you’re hitting the **dev** Neon project when running locally
- Run `npm run db:push` after schema changes (applies to `DEV_DATABASE_URL` when set)
- Cloudflare must have `DATABASE_URL` set and must **not** define `DEV_DATABASE_URL`

## More info

- `WORKFLOW.md` — development and deployment flow
- `CF_DEPLOYMENT.md` — Cloudflare deployment details
- `README_CLOUDFLARE.md` — architecture overview
- `.dev.vars.example` — full variable list
