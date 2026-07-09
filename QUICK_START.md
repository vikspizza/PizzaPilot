# Quick Start Guide

## Run locally (Wrangler)

This project targets **Cloudflare Pages + Functions**. Local development uses Wrangler with a Neon database.

```bash
# 1. Install dependencies
npm install

# 2. Environment (one-time)
cp .dev.vars.example .dev.vars
# Edit .dev.vars — set DATABASE_URL to your Neon connection string

# 3. Push schema (one-time or after schema changes)
export DATABASE_URL="your-neon-connection-string"
npm run db:push
npm run seed   # optional

# 4. Build and run
npm run dev:cf
```

App runs at the URL Wrangler prints (often `http://localhost:8788`).

## Deploy to Cloudflare

```bash
# Git push (if Pages is connected to your repo)
git push origin main

# Or manual deploy
npm run deploy:cf
```

Set `DATABASE_URL` as a **Secret** in Cloudflare Pages → Settings → Environment variables.

## Environment variables

| Where | File / place |
|-------|----------------|
| Local Wrangler | `.dev.vars` |
| Cloudflare Pages | Dashboard → Environment variables (Secret) |

Required: `DATABASE_URL` (Neon connection string with `?sslmode=require`).

## Optional: Express dev server

For a Node/Express + Vite workflow (not Cloudflare runtime):

```bash
export DATABASE_URL="your-neon-connection-string"
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

- Confirm `DATABASE_URL` in Neon dashboard
- Run `npm run db:push` after schema changes

## More info

- `WORKFLOW.md` — development and deployment flow
- `CF_DEPLOYMENT.md` — Cloudflare deployment details
- `README_CLOUDFLARE.md` — architecture overview
