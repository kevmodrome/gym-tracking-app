FROM node:22.12-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production image
FROM node:22.12-alpine

WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy built app and dependencies
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./

# Install production dependencies only (includes better-sqlite3)
RUN npm ci --only=production

# Create data directory for SQLite databases
RUN mkdir -p /app/data

# Set environment variables
ENV NODE_ENV=production
ENV DATA_DIR=/app/data

EXPOSE 3000

CMD ["node", "build"]
