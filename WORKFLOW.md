# Development & Deployment Workflow

This guide explains how to test locally and deploy to Cloudflare Pages.

## 🎯 Two Development Modes

You have **two options** for local development, each serving different purposes:

### Option 1: Docker (Full-Stack Testing)
- **Use when**: Testing the complete app with all features
- **Database**: Uses `pg` Pool (standard PostgreSQL driver)
- **Best for**: General development, debugging, full integration testing

### Option 2: Wrangler (Cloudflare-Specific Testing)
- **Use when**: Testing Cloudflare Functions compatibility
- **Database**: Uses Neon serverless driver (same as production)
- **Best for**: Ensuring Cloudflare deployment will work correctly

## 📋 Recommended Workflow

### Daily Development (Docker)

```bash
# 1. Start Docker services
docker compose up -d

# 2. Run migrations if needed
docker compose exec app npm run db:push

# 3. Start dev server
docker compose exec app npm run dev

# App runs at http://localhost:5000
```

**Why Docker?**
- Faster iteration (hot reload)
- Full Express server with all middleware
- Easier debugging
- Works exactly like your current setup

### Pre-Deployment Testing (Wrangler)

Before deploying to Cloudflare, test with Wrangler to catch Cloudflare-specific issues:

```bash
# 1. Build for Cloudflare
npm run build:cf

# 2. Create .dev.vars file (one-time setup)
echo "DATABASE_URL=your-neon-connection-string" > .dev.vars

# 3. Start Wrangler dev server
npx wrangler pages dev dist/public --compatibility-date=2024-01-01

# App runs at http://localhost:8788
```

**Why Wrangler?**
- Tests Cloudflare Functions runtime
- Uses same Neon serverless driver as production
- Catches Cloudflare-specific issues early
- Validates function routing

## 🔄 Complete Workflow

### Step 1: Daily Development (Docker)

```bash
# Start everything
docker compose up -d

# Make your changes
# ... edit code ...

# Test in browser
open http://localhost:5000
```

### Step 2: Pre-Deployment Check (Wrangler)

Before pushing to production:

```bash
# 1. Build for Cloudflare
npm run build:cf

# 2. Test with Wrangler
npx wrangler pages dev dist/public --compatibility-date=2024-01-01

# 3. Test all features:
# - API endpoints work
# - Database queries succeed
# - Static assets load
# - Functions routing is correct
```

### Step 3: Deploy to Cloudflare

```bash
# Option A: Via Git (Recommended)
git add .
git commit -m "Your changes"
git push origin main
# Cloudflare auto-deploys on push

# Option B: Via Wrangler CLI
npm run build:cf
npx wrangler pages deploy dist/public --project-name=pizzapilot
```

## 🛠️ Setup Instructions

### Initial Setup (One-Time)

1. **Install Wrangler globally** (optional, for convenience):
   ```bash
   npm install -g wrangler
   ```

2. **Create `.dev.vars` file** (for Wrangler local testing):
   ```bash
   echo "DATABASE_URL=your-neon-connection-string" > .dev.vars
   ```
   ⚠️ **Important**: Add `.dev.vars` to `.gitignore` (already done)

3. **Login to Cloudflare** (for deployments):
   ```bash
   npx wrangler login
   ```

### Environment Variables

**For Docker (local dev):**
- Set in `docker-compose.yml` or `.env` file
- Uses standard `DATABASE_URL`

**For Wrangler (Cloudflare testing):**
- Set in `.dev.vars` file (local)
- Uses same `DATABASE_URL` as production

**For Cloudflare Pages (production):**
- Set in Cloudflare Dashboard > Pages > Settings > Environment variables
- Mark as **Secret** (encrypted)

## 📝 Package.json Scripts

```json
{
  "dev": "NODE_ENV=development tsx server/index.ts",        // Docker dev
  "build": "tsx script/build.ts",                           // Docker build
  "build:cf": "tsx script/build-cf.ts",                      // Cloudflare build
  "start": "NODE_ENV=production node dist/index.cjs"        // Docker production
}
```

**New scripts you might want to add:**

```json
{
  "dev:cf": "npm run build:cf && wrangler pages dev dist/public --compatibility-date=2024-01-01",
  "deploy:cf": "npm run build:cf && wrangler pages deploy dist/public --project-name=pizzapilot"
}
```

## 🐛 Debugging Tips

### Docker Issues
```bash
# View logs
docker compose logs app

# Restart services
docker compose restart app

# Rebuild containers
docker compose build app && docker compose up -d
```

### Wrangler Issues
```bash
# Check Wrangler version
npx wrangler --version

# View detailed logs
npx wrangler pages dev dist/public --compatibility-date=2024-01-01 --log-level=debug

# Clear cache
rm -rf .wrangler
```

### Database Connection Issues

**Docker:**
- Check `docker-compose.yml` database config
- Verify `DATABASE_URL` in container

**Wrangler:**
- Verify `.dev.vars` file exists
- Check `DATABASE_URL` format (Neon connection string)
- Ensure database allows connections from your IP

**Cloudflare:**
- Verify `DATABASE_URL` is set in Pages settings
- Check it's marked as a Secret
- Ensure Neon database allows Cloudflare IPs

## ✅ Testing Checklist

Before deploying to Cloudflare:

- [ ] App builds successfully: `npm run build:cf`
- [ ] Wrangler dev server starts: `wrangler pages dev dist/public`
- [ ] All API endpoints work in Wrangler
- [ ] Database queries succeed (check logs)
- [ ] Static assets load (images, CSS, JS)
- [ ] Client-side routing works (React Router)
- [ ] Forms submit correctly
- [ ] No console errors in browser
- [ ] No errors in Wrangler terminal

## 🚀 Deployment Workflow Summary

```
┌─────────────────┐
│  Local Dev      │
│  (Docker)       │
│  localhost:5000 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Pre-Deploy     │
│  (Wrangler)     │
│  localhost:8788 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Deploy         │
│  (Cloudflare)   │
│  your-app.pages.dev
└─────────────────┘
```

## 💡 Pro Tips

1. **Use Docker for 90% of development** - It's faster and easier
2. **Use Wrangler before each deploy** - Catch Cloudflare issues early
3. **Test API endpoints in Wrangler** - Functions behave differently than Express
4. **Check function logs** - Cloudflare dashboard shows detailed function logs
5. **Use preview deployments** - Cloudflare creates preview URLs for PRs

## 🔗 Quick Reference

| Task | Command |
|------|---------|
| Start Docker dev | `docker compose up -d` |
| Build for Cloudflare | `npm run build:cf` |
| Test with Wrangler | `wrangler pages dev dist/public` |
| Deploy to Cloudflare | `wrangler pages deploy dist/public` |
| View Cloudflare logs | Cloudflare Dashboard > Pages > Functions |


