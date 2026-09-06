# Development & Deployment Workflow

PizzaPilot runs on **Cloudflare Pages** with **Pages Functions** and a **Neon** database.

## Local development

Use Wrangler to match production (Functions + Neon serverless driver):

```bash
cp .dev.vars.example .dev.vars   # once — set DEV_DATABASE_URL (+ optional DATABASE_URL)
npm run db:push                  # applies schema to DEV_DATABASE_URL when set
npm run dev:cf                   # build:cf + wrangler pages dev
npm run dev:holds                # second terminal — Try a Pie holds Durable Object
```

Test at the URL Wrangler prints (typically `http://localhost:8788`).

### Database URLs

| Variable | Purpose |
|----------|---------|
| `DEV_DATABASE_URL` | Local Wrangler + `db:push` (preferred when set) |
| `DATABASE_URL` | Production Neon URL; Cloudflare Pages secret. Also used locally if `DEV_DATABASE_URL` is unset |

Do **not** set `DEV_DATABASE_URL` in Cloudflare Pages. Production should only have `DATABASE_URL`.

### Optional: Express + Vite

`npm run dev` runs the Express server with Vite middleware. Useful for quick UI work, but **always verify with `npm run dev:cf`** before deploying.

```bash
export DATABASE_URL="your-dev-neon-connection-string"
npm run dev
```

## Pre-deploy checklist

- [ ] `npm run build:cf` succeeds
- [ ] `npm run dev:cf` — API health, pizzas, login, orders
- [ ] Static assets and `/attached_assets/` images load
- [ ] Client routes work (home, profile, admin, etc.)

## Deploy

**Git (recommended)**

```bash
git push origin main          # production (default branch in Cloudflare)
git push origin journey       # preview URL for branch
```

**CLI**

```bash
npm run deploy:cf
```

## Environment variables

| Context | Where | Notes |
|---------|--------|-------|
| Local | `.dev.vars` | Prefer `DEV_DATABASE_URL` for the testing DB |
| Cloudflare Pages | Dashboard → Settings → Environment variables | `DATABASE_URL` as Secret only |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev:cf` | Build for Cloudflare + Wrangler dev server |
| `npm run dev:holds` | Local Try a Pie holds Durable Object worker |
| `npm run build:cf` | Production build → `dist/public` |
| `npm run deploy:cf` | Build + `wrangler pages deploy` |
| `npm run dev` | Express + Vite (optional) |
| `npm run db:push` | Apply schema (prefers `DEV_DATABASE_URL`) |
| `npm run seed` | Seed sample data |

## Debugging Wrangler

```bash
npx wrangler --version
npx wrangler pages dev dist/public --compatibility-date=2024-01-01 --log-level=debug
rm -rf .wrangler
```

## Flow

```
Local (Wrangler + DEV_DATABASE_URL)  →  git push  →  Cloudflare Pages (DATABASE_URL secret)
     dev:cf              main / branches      preview + production
```

## More documentation

- `QUICK_START.md` — shortest path to running locally
- `CF_DEPLOYMENT.md` — deployment and troubleshooting
- `SETUP.md` — full setup and scripts reference
