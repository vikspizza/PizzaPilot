# Setup Guide for PizzaPilot

## Quick Start with Docker (Recommended)

The easiest way to run PizzaPilot is with Docker Compose:

```bash
# Build and start all services (production mode)
docker compose up --build

# Or for development with hot reload
docker compose --profile dev up --build

# Run in background (detached mode)
docker compose up --build -d
```

The app will be available at **http://localhost:5050**

**What this does:**
- Starts PostgreSQL 16 database in a container
- Builds and runs the Node.js app in a container
- Automatically waits for database to be ready
- Initializes the database schema (`db:push`)
- Seeds sample pizza data (3 pizzas + default settings)
- Both services communicate over a Docker network

**Default Database Credentials:**
- User: `pizzapilot`
- Password: `pizzapilot_dev`
- Database: `pizzapilot`
- Port: `5432` (exposed to host)

**To stop:**
```bash
docker compose down
```

**To stop and remove volumes (fresh database):**
```bash
docker compose down -v
```

See [Docker Setup](#docker-setup) section below for more details.

---

## Manual Setup (Without Docker)

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
- `npm run dev` - Start full-stack dev server (backend + frontend) - Docker/Node.js
- `npm run dev:client` - Start frontend only (port 5000)
- `npm run dev:cf` - Build and test with Cloudflare Wrangler (localhost:8788)

### Database
- `npm run db:push` - Push database schema changes
- `npm run seed` - Seed database with sample data
- `npm run init-db` - Push schema and seed database (combines db:push + seed)
- `npm run wait-for-db` - Wait for database to be ready (Node.js version)
- `npm run wait-for-db-simple` - Wait for database to be ready (shell script version)

### Build & Deploy
- `npm run build` - Build for production (Docker/Node.js)
- `npm run build:cf` - Build for Cloudflare Pages deployment
- `npm run deploy:cf` - Build and deploy to Cloudflare Pages
- `npm start` - Run production build (Docker/Node.js)

### Utilities
- `npm run check` - Type check TypeScript

## Testing the App

### Manual Setup
1. **Home Page**: Browse available pizzas at http://localhost:5000
2. **Login**: Go to http://localhost:5000/login
   - Enter any phone number
   - Check your terminal/console for the OTP code (SMS not implemented yet)
   - Enter the 6-digit code to log in
3. **Place an Order**: Click "Order" on any pizza, fill out the form
4. **Admin Dashboard**: Go to http://localhost:5000/admin
   - Password: `admin`
   - View orders and manage menu items

### Docker Setup
1. **Home Page**: Browse available pizzas at http://localhost:5050
2. **Login**: Go to http://localhost:5050/login
   - Enter any phone number
   - Check Docker logs for the OTP code: `docker compose logs app | grep OTP`
   - Enter the 6-digit code to log in
3. **Place an Order**: Click "Order" on any pizza, fill out the form
4. **Admin Dashboard**: Go to http://localhost:5050/admin
   - Password: `admin`
   - View orders and manage menu items
5. **API Health Check**: http://localhost:5050/api/health

## Troubleshooting

### Manual Setup Issues

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

### Docker Issues

**Port Already in Use:**
- Docker setup uses port **5050** by default (to avoid macOS conflicts)
- If 5050 is in use, edit `docker-compose.yml` and change the port mapping:
  ```yaml
  ports:
    - "3000:5000"  # Change 3000 to your preferred port
  ```

**Database Connection Errors:**
- Check if database container is healthy: `docker compose ps`
- View database logs: `docker compose logs postgres`
- Verify DATABASE_URL in app container: `docker compose exec app env | grep DATABASE_URL`
- Ensure containers are on the same network

**Container Won't Start:**
- Check logs: `docker compose logs app`
- Rebuild from scratch: `docker compose down -v && docker compose build --no-cache && docker compose up`
- Verify Docker has enough resources allocated

**Permission Issues:**
- If you see permission errors, check file ownership: `ls -la`
- Fix permissions: `sudo chown -R $USER:$USER .`

**Out of Disk Space:**
- Clean up Docker: `docker system prune -a --volumes`
- Remove unused images: `docker image prune -a`

## Docker Setup

### Prerequisites

- **Docker Desktop** (or Docker Engine + Docker Compose)
  - Download from [docker.com](https://www.docker.com/products/docker-desktop)
  - Ensure Docker is running: `docker --version`

### Production Mode

```bash
# Build and start
docker compose up --build

# Run in background (detached mode)
docker compose up --build -d

# View logs
docker compose logs -f app

# Stop services
docker compose down
```

The app will be available at **http://localhost:5050**

### Development Mode (with hot reload)

```bash
# Start development environment
docker compose --profile dev up --build

# The app will auto-reload on code changes
# Source code is mounted as a volume for live updates
```

### Database Management

```bash
# Access PostgreSQL directly
docker compose exec postgres psql -U pizzapilot -d pizzapilot

# Reset database (removes all data)
docker compose down -v
docker compose up --build

# Backup database
docker compose exec postgres pg_dump -U pizzapilot pizzapilot > backup.sql

# Restore database
docker compose exec -T postgres psql -U pizzapilot pizzapilot < backup.sql
```

### Custom Configuration

You can override environment variables by creating a `.env` file:

```env
# Override database credentials
POSTGRES_USER=myuser
POSTGRES_PASSWORD=mypassword
POSTGRES_DB=mydb

# Override app port (change in docker-compose.yml ports mapping)
PORT=5000
```

Or modify `docker-compose.yml` directly to change:
- Database credentials
- Port mappings (default: 5050:5000 for app, 5432:5432 for database)
- Volume mounts
- Environment variables

### Docker Commands Reference

```bash
# Build images
docker compose build

# Start services
docker compose up

# Start in background
docker compose up -d

# Stop services (keep containers)
docker compose stop

# Stop and remove containers
docker compose down

# Stop and remove containers + volumes (fresh start)
docker compose down -v

# View logs
docker compose logs -f              # All services
docker compose logs -f app          # App only
docker compose logs postgres        # Database only

# Execute commands in container
docker compose exec app npm run seed
docker compose exec app npm run check
docker compose exec postgres psql -U pizzapilot -d pizzapilot

# Check container status
docker compose ps

# Rebuild after code changes
docker compose build app
docker compose up -d app
```

### Architecture

The Docker setup includes:

- **PostgreSQL Container** (`pizzapilot-db`)
  - Image: `postgres:16-alpine`
  - Data persists in Docker volume `postgres_data`
  - Health checks ensure database is ready before app starts

- **App Container** (`pizzapilot-app`)
  - Multi-stage build for optimized image size
  - Uses standard `pg` driver for PostgreSQL (not Neon serverless)
  - Automatically runs database initialization on startup
  - Serves both API and frontend

Both containers communicate over the `pizzapilot-network` bridge network.

## Notes

### General
- OTP codes are currently logged to the console (not sent via SMS)
- Admin password is hardcoded as "admin" (not production-ready)
- Payment processing is not implemented (pay at pickup model)
- App supports both Docker/Node.js and Cloudflare Pages deployment

### Docker-Specific
- Docker setup uses PostgreSQL 16 Alpine for the database
- Database data persists in a Docker volume (`postgres_data`)
- Uses standard `pg` driver for PostgreSQL (not Neon serverless driver)
- App automatically initializes database schema and seeds data on first start
- Default port is **5050** (to avoid macOS port 5000 conflicts)
- Both containers use a shared Docker network for communication

### Cloudflare-Specific
- API routes converted to Cloudflare Pages Functions (`functions/api/[[path]].ts`)
- Static files served from `dist/public/`
- Uses Neon serverless driver (required for serverless functions)
- Environment variables set in Cloudflare Dashboard (as Secrets)
- Functions automatically handle all `/api/*` routes

### Database Drivers
- **Docker/Standard PostgreSQL**: Uses `pg` driver with `drizzle-orm/node-postgres`
- **Neon Cloud (Local Testing)**: Uses Neon serverless driver when `USE_NEON=true` or in Cloudflare environment
- **Cloudflare Pages**: Automatically uses Neon serverless driver (required for serverless functions)
- The app automatically detects the environment and uses the appropriate driver

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
- **Full Workflow**: See `WORKFLOW.md` (Docker vs Wrangler vs Cloudflare)
- **Deployment Guide**: See `CF_DEPLOYMENT.md` (detailed instructions)
- **Cloudflare Overview**: See `README_CLOUDFLARE.md`

### Development Modes

**Docker (Recommended for Daily Development)**
- Fast iteration with hot reload
- Full Express server
- Uses `pg` driver
- Run: `docker compose up -d`

**Wrangler (Cloudflare Testing)**
- Tests Cloudflare Functions compatibility
- Uses Neon serverless driver (same as production)
- Run: `npm run dev:cf`

**Cloudflare Pages (Production)**
- Serverless deployment
- Uses Neon serverless driver
- Deploy: `npm run deploy:cf` or Git push
