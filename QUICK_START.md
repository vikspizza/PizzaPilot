# Quick Start Guide

## 🚀 Two Ways to Run Locally

### Option 1: Docker (Recommended for Daily Development)

```bash
# Start everything
docker compose up -d

# App runs at http://localhost:5000
# Full Express server with hot reload
```

**Use Docker when:**
- Developing new features
- Debugging issues
- Testing full-stack functionality
- You want fast iteration

### Option 2: Wrangler (Cloudflare Testing)

```bash
# 1. Build for Cloudflare
npm run build:cf

# 2. Create .dev.vars (one-time setup)
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your Neon DATABASE_URL

# 3. Start Wrangler dev server
npm run dev:cf
# Or: npx wrangler pages dev dist/public --compatibility-date=2024-01-01

# App runs at http://localhost:8788
```

**Use Wrangler when:**
- Testing before deployment
- Verifying Cloudflare Functions work
- Ensuring production compatibility
- Debugging Cloudflare-specific issues

## 📦 First-Time Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database

**Option A: Neon DB (Recommended for Cloudflare)**

1. Create a Neon database at [neon.tech](https://neon.tech) (free tier available)
2. Get your connection string from the Neon dashboard
3. Run the schema:

```bash
# Option 1: Use the SQL file directly (easiest)
# Copy schema.sql and run it in Neon's SQL Editor

# Option 2: Use Drizzle push
export DATABASE_URL="your-neon-connection-string"
npm run db:push

# Seed data (optional)
npm run seed
```

**Option B: Docker (Local PostgreSQL)**

```bash
# Start Docker
docker compose up -d

# Push schema
docker compose exec app npm run db:push

# Seed data (optional)
docker compose exec app npm run seed
```

### 3. Setup Cloudflare Testing (Optional)
```bash
# Install Wrangler (if not already installed)
npm install -g wrangler

# Create .dev.vars file
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your Neon DATABASE_URL

# Login to Cloudflare (for deployments)
wrangler login
```

## 🎯 Daily Workflow

### Development (Docker)
```bash
docker compose up -d
# Make changes, test at http://localhost:5000
```

### Pre-Deployment Testing (Wrangler)
```bash
npm run build:cf
npm run dev:cf
# Test at http://localhost:8788
```

### Deploy to Cloudflare
```bash
# Option A: Git push (auto-deploys)
git push origin main

# Option B: Manual deploy
npm run deploy:cf
```

## 🔑 Environment Variables

**Docker:** Set in `docker-compose.yml` or `.env`

**Wrangler:** Set in `.dev.vars` file

**Cloudflare:** Set in Cloudflare Dashboard > Pages > Settings > Environment variables

All need: `DATABASE_URL` (your Neon connection string)

## ❓ Which Should I Use?

| Scenario | Use |
|----------|-----|
| Daily coding | Docker |
| Adding features | Docker |
| Debugging | Docker |
| Before deploying | Wrangler |
| Testing Functions | Wrangler |
| Production | Cloudflare Pages |

## 🆘 Troubleshooting

**Docker not starting?**
```bash
docker compose down
docker compose up -d
docker compose logs app
```

**Wrangler errors?**
```bash
# Check .dev.vars exists and has DATABASE_URL
cat .dev.vars

# Clear Wrangler cache
rm -rf .wrangler
```

**Database connection issues?**
- Verify `DATABASE_URL` is correct
- Check Neon dashboard for connection status
- For Neon: Ensure SSL mode is enabled (`?sslmode=require` in connection string)
- For Docker: Check that PostgreSQL container is running: `docker compose ps`

## 📚 More Info

- **Full workflow**: See `WORKFLOW.md`
- **Deployment guide**: See `CF_DEPLOYMENT.md`
- **Cloudflare docs**: See `README_CLOUDFLARE.md`


