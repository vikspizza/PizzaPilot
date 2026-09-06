# Cloudflare Pages Deployment

This app is configured to deploy on Cloudflare Pages with Pages Functions.

## Setup Instructions

1. **Connect to Cloudflare Pages:**
   - Go to Cloudflare Dashboard > Pages
   - Connect your Git repository
   - Set build command: `npm run build:cf`
   - Set output directory: `dist/public`

2. **Set Environment Variables:**
   - In Cloudflare Pages settings, add the following environment variable:
     - `DATABASE_URL`: Your **production** Neon database connection string (Secret)
   - Do **not** set `DEV_DATABASE_URL` in Cloudflare (local-only via `.dev.vars`)
   - For production: Set in "Production" environment
   - For preview: Set in "Preview" environment

3. **Deploy:**
   - Push to your main branch to trigger production deployment
   - Create a PR to trigger preview deployment

## Database Setup

1. Get your Neon connection strings from your Neon project (dev + production)
2. Local `.dev.vars`: set `DEV_DATABASE_URL` (testing) and optionally `DATABASE_URL` (prod reference)
3. Cloudflare: add production URL as `DATABASE_URL` secret only
4. Connection strings should look like:
   ```
   postgresql://user:password@host.neon.tech/dbname?sslmode=require
   ```

## Static Assets

The `attached_assets` folder needs to be copied to the public directory during build.
This is handled automatically in the build script.


