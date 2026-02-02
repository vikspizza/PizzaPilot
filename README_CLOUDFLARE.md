# Cloudflare Pages Deployment - Quick Start

## ✅ What's Been Done

Your app has been refactored for Cloudflare Pages + Functions:

1. ✅ **Database**: Updated to use Neon serverless driver (already in dependencies)
2. ✅ **Functions**: Created `functions/api/[[path]].ts` - handles all API routes
3. ✅ **Build**: Added `build:cf` script for Cloudflare deployment
4. ✅ **Config**: Added `wrangler.toml` for Cloudflare configuration
5. ✅ **Static Assets**: Build script copies `attached_assets` to public directory

## 🚀 Quick Deploy Steps

### 1. Push Database Schema

```bash
export DATABASE_URL="your-neon-connection-string"
npm run db:push
npm run seed  # Optional: seed initial data
```

### 2. Deploy to Cloudflare Pages

**Via Dashboard:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) > Pages
2. Connect your Git repository
3. Build settings:
   - Build command: `npm run build:cf`
   - Output directory: `dist/public`
4. Add environment variable:
   - Name: `DATABASE_URL`
   - Value: Your Neon connection string
   - **Make it a Secret** (encrypted)

**Via CLI:**
```bash
npm install -g wrangler
wrangler login
wrangler pages secret put DATABASE_URL
npm run build:cf
wrangler pages deploy dist/public --project-name=pizzapilot
```

## 📁 Project Structure

```
PizzaPilot/
├── functions/
│   └── api/
│       └── [[path]].ts    # All API routes (Cloudflare Functions)
├── client/                 # React frontend
├── server/                 # Server code (used by functions)
├── shared/                 # Shared schemas
├── dist/
│   └── public/            # Build output (static files)
├── wrangler.toml          # Cloudflare config
└── package.json           # Includes build:cf script
```

## 🔧 How It Works

1. **Static Files**: Built React app in `dist/public/` served by Cloudflare Pages
2. **API Routes**: All `/api/*` requests handled by `functions/api/[[path]].ts`
3. **Database**: Uses Neon serverless driver (automatically detected in Cloudflare)
4. **Assets**: `attached_assets/` copied to `dist/public/attached_assets/` during build

## 📝 Environment Variables

Set in Cloudflare Pages dashboard:
- `DATABASE_URL`: Your Neon database connection string (as a Secret)

## 🧪 Local Testing

```bash
# Create .dev.vars for local testing
echo "DATABASE_URL=your-neon-connection-string" > .dev.vars

# Run local Cloudflare Pages dev server
wrangler pages dev dist/public --compatibility-date=2024-01-01
```

## ⚠️ Important Notes

1. **Database Connection**: The app automatically uses Neon serverless driver in Cloudflare environment
2. **Static Assets**: Image paths should be absolute (e.g., `/attached_assets/image.png`)
3. **Functions**: All Express routes have been converted to Cloudflare Functions format
4. **Build**: Use `npm run build:cf` (not regular `npm run build`) for Cloudflare deployment

## 📚 Full Documentation

See `CF_DEPLOYMENT.md` for detailed deployment instructions and troubleshooting.

## 🎉 You're Ready!

Your app is now configured for Cloudflare Pages. Just:
1. Set your `DATABASE_URL` in Cloudflare Pages
2. Deploy!
3. Enjoy serverless pizza 🍕


