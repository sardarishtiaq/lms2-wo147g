# ---- Build Stage ----
FROM node:18-alpine AS builder

# Add build dependencies
RUN apk add --no-cache python3 make g++ git

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies with exact versions for reproducibility
RUN npm ci --no-audit

# Copy source code and config files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript application
RUN npm run build

# Run security audit and prune dev dependencies
RUN npm audit && \
    npm prune --production

# ---- Production Stage ----
FROM node:18-alpine

# Add production dependencies
RUN apk add --no-cache curl tzdata

# Create non-root user
RUN addgroup -g 1001 nodejs && \
    adduser -u 1001 -G nodejs -s /bin/sh -D nodejs

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production \
    PORT=3000 \
    TZ=UTC

# Copy built artifacts from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Set directory permissions
RUN chmod 755 /app

# Configure resource limits
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Healthcheck configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose application port
EXPOSE 3000

# Switch to non-root user
USER nodejs

# Set resource constraints
LABEL com.docker.resource.cpu="2" \
      com.docker.resource.memory="4g" \
      com.docker.resource.pids="50" \
      com.docker.resource.nofile="1000"

# Start application
CMD ["node", "dist/index.js"]