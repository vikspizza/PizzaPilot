# Docker Setup Guide

This guide explains how to run PizzaPilot using Docker and Docker Compose.

## Prerequisites

- **Docker Desktop** (or Docker Engine + Docker Compose)
  - Download from [docker.com](https://www.docker.com/products/docker-desktop)
  - Ensure Docker is running: `docker --version`

## Quick Start

### Production Mode

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode (background)
docker-compose up -d --build
```

The app will be available at **http://localhost:5000**

### Development Mode (Hot Reload)

```bash
# Start with hot reload enabled
docker-compose --profile dev up --build
```

Changes to your code will automatically reload the app.

## What Gets Started

1. **PostgreSQL Database** (`pizzapilot-db`)
   - PostgreSQL 16 Alpine
   - Port: 5432 (exposed to host)
   - Data persists in Docker volume `postgres_data`
   - Credentials:
     - User: `pizzapilot`
     - Password: `pizzapilot_dev`
     - Database: `pizzapilot`

2. **PizzaPilot App** (`pizzapilot-app`)
   - Node.js 20 Alpine
   - Port: 5000
   - Automatically:
     - Waits for database to be ready
     - Pushes database schema
     - Seeds sample pizza data
     - Starts the application

## Common Commands

### Start Services
```bash
docker-compose up              # Start in foreground
docker-compose up -d           # Start in background
docker-compose up --build      # Rebuild and start
```

### Stop Services
```bash
docker-compose stop            # Stop services (keep containers)
docker-compose down            # Stop and remove containers
docker-compose down -v         # Stop and remove containers + volumes (fresh DB)
```

### View Logs
```bash
docker-compose logs            # All services
docker-compose logs -f app     # Follow app logs
docker-compose logs postgres   # Database logs
```

### Execute Commands
```bash
# Run database seed script
docker-compose exec app npm run seed

# Access PostgreSQL shell
docker-compose exec postgres psql -U pizzapilot -d pizzapilot

# Run TypeScript check
docker-compose exec app npm run check
```

### Rebuild After Changes
```bash
# Rebuild app container
docker-compose build app
docker-compose up -d

# Rebuild everything
docker-compose build --no-cache
docker-compose up -d
```

## Customization

### Change Database Credentials

Edit `docker-compose.yml`:

```yaml
postgres:
  environment:
    POSTGRES_USER: your_user
    POSTGRES_PASSWORD: your_password
    POSTGRES_DB: your_db

app:
  environment:
    DATABASE_URL: postgresql://your_user:your_password@postgres:5432/your_db
```

### Change Port

Edit `docker-compose.yml`:

```yaml
app:
  ports:
    - "3000:5000"  # Host:Container
```

### Environment Variables

Create a `.env` file in the project root:

```env
POSTGRES_USER=pizzapilot
POSTGRES_PASSWORD=my_secure_password
POSTGRES_DB=pizzapilot
PORT=5000
```

Docker Compose will automatically load `.env` file.

## Database Management

### Reset Database

```bash
# Remove database volume (all data will be lost)
docker-compose down -v
docker-compose up --build
```

### Backup Database

```bash
# Create backup
docker-compose exec postgres pg_dump -U pizzapilot pizzapilot > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U pizzapilot pizzapilot < backup.sql
```

### Access Database Directly

```bash
# Using psql
docker-compose exec postgres psql -U pizzapilot -d pizzapilot

# Using connection string from host machine
psql postgresql://pizzapilot:pizzapilot_dev@localhost:5432/pizzapilot
```

## Troubleshooting

### Port Already in Use

If port 5000 or 5432 is already in use:

```bash
# Find what's using the port
lsof -i :5000
lsof -i :5432

# Change ports in docker-compose.yml
```

### Database Connection Errors

1. Check if database is healthy:
   ```bash
   docker-compose ps
   ```

2. Check database logs:
   ```bash
   docker-compose logs postgres
   ```

3. Verify DATABASE_URL in app container:
   ```bash
   docker-compose exec app env | grep DATABASE_URL
   ```

### Container Won't Start

1. Check logs:
   ```bash
   docker-compose logs app
   ```

2. Rebuild from scratch:
   ```bash
   docker-compose down -v
   docker-compose build --no-cache
   docker-compose up
   ```

### Permission Issues

If you see permission errors:

```bash
# Fix file permissions
sudo chown -R $USER:$USER .
```

### Out of Disk Space

```bash
# Clean up Docker
docker system prune -a --volumes

# Remove unused images
docker image prune -a
```

## Development Workflow

### Making Code Changes

**With dev profile (hot reload):**
```bash
docker-compose --profile dev up
# Edit files, changes auto-reload
```

**Without dev profile:**
```bash
# After making changes
docker-compose build app
docker-compose up -d app
```

### Adding Dependencies

1. Edit `package.json`
2. Rebuild container:
   ```bash
   docker-compose build app
   docker-compose up -d app
   ```

Or in dev mode, install in container:
```bash
docker-compose exec app npm install <package>
```

## Production Deployment

For production, consider:

1. **Use environment variables** for sensitive data (don't hardcode passwords)
2. **Use secrets management** (Docker secrets, AWS Secrets Manager, etc.)
3. **Enable SSL/TLS** for database connections
4. **Use a reverse proxy** (nginx, Traefik) in front of the app
5. **Set up proper logging** and monitoring
6. **Use health checks** and restart policies
7. **Backup strategy** for database volumes

Example production `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  app:
    restart: unless-stopped
    environment:
      NODE_ENV: production
    # ... other config
```

Run with:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Architecture

```
┌─────────────────┐
│   Host Machine  │
│                 │
│  ┌───────────┐  │
│  │   App     │  │  Port 5000
│  │ Container │  │  ──────────► http://localhost:5000
│  └─────┬─────┘  │
│        │        │
│        │ Network│
│        │        │
│  ┌─────▼─────┐  │
│  │ PostgreSQL│  │  Port 5432
│  │ Container │  │  ──────────► localhost:5432
│  └───────────┘  │
│                 │
│  Volume:        │
│  postgres_data  │
└─────────────────┘
```

Both containers communicate over the `pizzapilot-network` bridge network.

