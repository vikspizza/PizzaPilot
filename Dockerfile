# Multi-stage build for PizzaPilot

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy scripts needed for initialization
COPY scripts ./scripts

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner

# Install PostgreSQL client for wait script
RUN apk add --no-cache postgresql-client

WORKDIR /app

# Install all dependencies (needed for db:push and seed scripts)
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client ./client
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/attached_assets ./attached_assets
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Change ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "dist/index.cjs"]
