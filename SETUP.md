# Setup Guide for PizzaPilot

## Quick Start (Wrangler + Neon)

Recommended local workflow — matches Cloudflare Pages production:

```bash
npm install
cp .dev.vars.example .dev.vars   # set DATABASE_URL to your Neon connection string
export DATABASE_URL="your-neon-connection-string"
npm run db:push
npm run seed                     # optional
npm run dev:cf
```

Open the URL Wrangler prints (often `http://localhost:8788`).

See `QUICK_START.md` for a shorter guide and `CF_DEPLOYMENT.md` for deploy details.

---

## Local Setup

### Prerequisites

1. **Node.js** (v18 or higher recommended)
   - Check your version: `node --version`
   - Download from [nodejs.org](https://nodejs.org/) if needed

2. **PostgreSQL Database**
   You have two options:

   **Option A: Use Neon (Cloud PostgreSQL - Recommended for Quick Start)**
   - Sign up at [neon.tech](https://neon.tech) (free tier available)
   - Create a new project
   - Copy the connection string (it will look like: `postgresql://user:password@host/database?sslmode=require`)

   **Option B: Use Local PostgreSQL**
   - Install PostgreSQL on your Mac:
     ```bash
     brew install postgresql@14
     brew services start postgresql@14
     ```
   - Create a database:
     ```bash
     createdb pizzapilot
     ```
   - Your connection string will be: `postgresql://localhost/pizzapilot`

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Then edit `.env` and add your database URL:

```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

**For local PostgreSQL:**
```env
DATABASE_URL=postgresql://localhost/pizzapilot
```

### 3. Push Database Schema

This creates all the necessary tables in your database:

```bash
npm run db:push
```

### 4. Seed the Database (Optional)

This adds sample pizzas and default settings:

```bash
npm run seed
```

### 5. Start Development Server

The dev server runs both the backend API and frontend:

```bash
npm run dev
```

The app will be available at:
- **Frontend**: http://localhost:5000
- **API**: http://localhost:5000/api

**Note**: On macOS, port 5000 may be in use by AirPlay Receiver. If you encounter port conflicts, use a different port by setting `PORT=3000 npm run dev` (or any other available port).

## Available Scripts

### Development
- `npm run dev:cf` - Build and run with Cloudflare Wrangler (recommended)
- `npm run dev` - Start Express + Vite dev server (optional; port 5000)
- `npm run dev:client` - Start frontend only (port 5000)

### Database
- `npm run db:push` - Push database schema changes
- `npm run seed` - Seed database with sample data
- `npm run init-db` - Push schema and seed database (combines db:push + seed)
- `npm run wait-for-db` - Wait for database to be ready (Node.js version)
- `npm run wait-for-db-simple` - Wait for database to be ready (shell script version)

### Build & Deploy
- `npm run build:cf` - Build for Cloudflare Pages deployment
- `npm run deploy:cf` - Build and deploy to Cloudflare Pages
- `npm run build` - Build for Node/Express production (optional)
- `npm start` - Run Node production build (optional)

### Utilities
- `npm run check` - Type check TypeScript

## Testing the App

With `npm run dev:cf` (Wrangler) or `npm run dev` (Express), use your local base URL:

1. **Home Page**: Browse available pizzas
2. **Login**: `/login` — enter any phone number; OTP is logged in the terminal (SMS not implemented)
3. **Place an Order**: Click "Order" on any pizza
4. **Admin Dashboard**: `/admin` — password `admin`
5. **API Health Check**: `/api/health`

## Troubleshooting

### Common Issues

**Database Connection Issues:**
- Make sure your `DATABASE_URL` is correct
- For Neon: Ensure SSL mode is enabled (`?sslmode=require`)
- For local: Make sure PostgreSQL is running (`brew services list`)

**Port Already in Use:**
- The app uses port 5000 by default
- Change it by setting `PORT` environment variable: `PORT=3000 npm run dev`
- On macOS, port 5000 is often used by AirPlay Receiver - use a different port

**TypeScript Errors:**
- Run `npm run check` to see all type errors
- Make sure all dependencies are installed: `npm install`

**Wrangler / Cloudflare:**
- Confirm `.dev.vars` has `DATABASE_URL`
- Clear cache: `rm -rf .wrangler` then `npm run dev:cf`

## Notes

### General
- OTP codes are currently logged to the console (not sent via SMS)
- Admin password is hardcoded as "admin" (not production-ready)
- Payment processing is not implemented (pay at pickup model)
- Production target is **Cloudflare Pages** with Neon

### Cloudflare-Specific
- API routes converted to Cloudflare Pages Functions (`functions/api/[[path]].ts`)
- Static files served from `dist/public/`
- Uses Neon serverless driver (required for serverless functions)
- Environment variables set in Cloudflare Dashboard (as Secrets)
- Functions automatically handle all `/api/*` routes

### Database Drivers
- **Cloudflare Pages / Wrangler**: Neon serverless driver (default in Functions)
- **Express (`npm run dev`)**: `pg` driver with `drizzle-orm/node-postgres`
- Set `USE_NEON=true` to force Neon driver in Node for parity testing

## Cloudflare Pages Deployment

This app is configured to deploy on Cloudflare Pages with Pages Functions.

### Quick Start
1. **Setup Database**: Push schema to your Neon database
   ```bash
   export DATABASE_URL="your-neon-connection-string"
   npm run db:push
   npm run seed
   ```

2. **Test Locally with Wrangler** (recommended before deploying):
   ```bash
   # Create .dev.vars file
   cp .dev.vars.example .dev.vars
   # Edit .dev.vars with your Neon DATABASE_URL
   
   # Build and test
   npm run build:cf
   npm run dev:cf
   # App runs at http://localhost:8788
   ```

3. **Deploy to Cloudflare Pages**:
   - Connect your Git repo in Cloudflare Dashboard > Pages
   - Build command: `npm run build:cf`
   - Output directory: `dist/public`
   - Add `DATABASE_URL` as an encrypted Secret

### Documentation
- **Quick Start**: See `QUICK_START.md`
- **Full Workflow**: See `WORKFLOW.md`
- **Deployment Guide**: See `CF_DEPLOYMENT.md` (detailed instructions)
- **Cloudflare Overview**: See `README_CLOUDFLARE.md`

### Development Modes

**Wrangler (recommended)**
- Matches Cloudflare Pages + Functions
- Uses Neon serverless driver
- Run: `npm run dev:cf`

**Express + Vite (optional)**
- Faster UI iteration; uses `pg` against Neon
- Run: `npm run dev`

**Cloudflare Pages (production)**
- Deploy: `npm run deploy:cf` or Git push to connected branch
