# Cloudflare Pages Deployment Guide

This guide will help you deploy PizzaPilot to Cloudflare Pages with Pages Functions.

## Prerequisites

1. A Cloudflare account
2. A Neon database project (free tier works)
3. Your Neon database connection string

## Step 1: Database Setup

1. Go to your Neon project dashboard
2. Copy your connection string (it should look like):
   ```
   postgresql://user:password@host.neon.tech/dbname?sslmode=require
   ```
3. Keep this handy for Step 3

## Step 2: Push Database Schema

Before deploying, make sure your database schema is up to date:

```bash
# Set your DATABASE_URL
export DATABASE_URL="your-neon-connection-string"

# Push schema to database
npm run db:push

# Optionally seed initial data
npm run seed
```

## Step 3: Deploy to Cloudflare Pages

### Option A: Via Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) > Pages
2. Click "Create a project" > "Connect to Git"
3. Select your repository
4. Configure build settings:
   - **Framework preset**: None (or Vite)
   - **Build command**: `npm run build:cf`
   - **Build output directory**: `dist/public`
   - **Root directory**: `/` (leave empty)
5. Click "Save and Deploy"

### Option B: Via Wrangler CLI

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Set your database URL as a secret
wrangler pages secret put DATABASE_URL

# Deploy
npm run build:cf
wrangler pages deploy dist/public --project-name=pizzapilot
```

## Step 4: Configure Environment Variables

1. In Cloudflare Pages dashboard, go to your project
2. Navigate to **Settings** > **Environment variables**
3. Add the following:
   - **Variable name**: `DATABASE_URL`
   - **Value**: Your Neon connection string
   - **Environment**: Select both "Production" and "Preview"

**Important**: For security, use **Secrets** instead of plain environment variables:
1. Go to **Settings** > **Environment variables**
2. Click "Add variable"
3. Select "Encrypt" to make it a secret
4. Add `DATABASE_URL` as an encrypted secret

## Step 5: Verify Deployment

1. After deployment completes, visit your Pages URL
2. Test the API endpoints:
   - `https://your-project.pages.dev/api/health` should return `{"status":"ok"}`
   - `https://your-project.pages.dev/api/pizzas` should return pizza data

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is set correctly in Cloudflare Pages settings
- Check that your Neon database allows connections from Cloudflare IPs
- Ensure the connection string includes `?sslmode=require`

### Build Failures

- Check build logs in Cloudflare Pages dashboard
- Ensure all dependencies are in `package.json`
- Verify Node.js version compatibility (Cloudflare uses Node 18+)

### Function Errors

- Check Functions logs in Cloudflare dashboard
- Verify all imports are correct
- Ensure `functions/` directory structure is correct

## Local Development with Cloudflare

To test locally with Wrangler:

```bash
# Install Wrangler
npm install -g wrangler

# Create .dev.vars file (for local development)
echo "DATABASE_URL=your-neon-connection-string" > .dev.vars

# Run local development server
wrangler pages dev dist/public --compatibility-date=2024-01-01
```

## Static Assets

The `attached_assets` folder (pizza images) is automatically copied to `dist/public/attached_assets` during build.

Make sure image paths in your code reference `/attached_assets/...` (absolute paths work best on Cloudflare Pages).

## Custom Domain

1. In Cloudflare Pages dashboard, go to **Custom domains**
2. Click "Set up a custom domain"
3. Follow the DNS configuration instructions
4. Cloudflare will automatically provision SSL certificates

## Monitoring

- View function logs in Cloudflare dashboard > Pages > Your project > Functions
- Set up alerts for errors in Cloudflare dashboard
- Monitor database connections in Neon dashboard

## Cost Considerations

- **Cloudflare Pages**: Free tier includes 500 builds/month, unlimited requests
- **Cloudflare Functions**: Free tier includes 100,000 requests/day
- **Neon Database**: Free tier includes 0.5 GB storage, shared CPU

For most small to medium apps, the free tiers should be sufficient!


