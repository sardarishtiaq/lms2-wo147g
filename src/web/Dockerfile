# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory with proper permissions
WORKDIR /app

# Add non-root user for build process
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser && \
    chown -R appuser:appgroup /app

# Set build arguments with validation
ARG API_URL
ARG WS_URL
ARG APP_VERSION
ARG TENANT_ID

# Validate build arguments
RUN if [ -z "$API_URL" ] || ! echo "$API_URL" | grep -E '^https?://[\w.-]+(:[\d]+)?$'; then \
    echo "Invalid or missing API_URL" && exit 1; \
    fi && \
    if [ -z "$WS_URL" ] || ! echo "$WS_URL" | grep -E '^wss?://[\w.-]+(:[\d]+)?$'; then \
    echo "Invalid or missing WS_URL" && exit 1; \
    fi && \
    if [ -z "$APP_VERSION" ] || ! echo "$APP_VERSION" | grep -E '^\d+\.\d+\.\d+$'; then \
    echo "Invalid or missing APP_VERSION" && exit 1; \
    fi && \
    if [ -z "$TENANT_ID" ] || ! echo "$TENANT_ID" | grep -E '^[a-zA-Z0-9-]+$'; then \
    echo "Invalid or missing TENANT_ID" && exit 1; \
    fi

# Set build environment variables
ENV NODE_ENV=production \
    VITE_API_URL=$API_URL \
    VITE_WS_URL=$WS_URL \
    VITE_APP_VERSION=$APP_VERSION \
    VITE_TENANT_ID=$TENANT_ID

# Copy package files with explicit permissions
COPY --chown=appuser:appgroup package*.json ./

# Install dependencies with security flags
RUN npm ci --production --frozen-lockfile --ignore-scripts && \
    npm cache clean --force

# Copy source code with proper ownership
COPY --chown=appuser:appgroup . .

# Build application with optimization flags
RUN npm run build && \
    rm -rf node_modules && \
    npm ci --production --frozen-lockfile --ignore-scripts && \
    npm cache clean --force

# Switch to non-root user for remaining build process
USER appuser

# Stage 2: Production stage
FROM nginx:alpine

# Add non-root user for nginx
RUN addgroup -g 1001 nginxgroup && \
    adduser -u 1001 -G nginxgroup -s /bin/sh -D nginxuser && \
    # Remove default nginx configuration
    rm /etc/nginx/conf.d/default.conf && \
    # Create necessary directories with proper permissions
    mkdir -p /var/cache/nginx /var/run && \
    chown -R nginxuser:nginxgroup /var/cache/nginx /var/run

# Copy built files from builder stage
COPY --from=builder --chown=nginxuser:nginxgroup /app/dist /usr/share/nginx/html

# Copy nginx configuration with security headers
COPY --chown=nginxuser:nginxgroup nginx.conf /etc/nginx/nginx.conf

# Configure security headers
RUN echo 'add_header X-Frame-Options "DENY";' >> /etc/nginx/conf.d/security.conf && \
    echo 'add_header X-Content-Type-Options "nosniff";' >> /etc/nginx/conf.d/security.conf && \
    echo 'add_header X-XSS-Protection "1; mode=block";' >> /etc/nginx/conf.d/security.conf && \
    echo 'add_header Referrer-Policy "strict-origin-when-cross-origin";' >> /etc/nginx/conf.d/security.conf && \
    echo 'add_header Content-Security-Policy "default-src '\''self'\''; script-src '\''self'\'' '\''unsafe-inline'\''; style-src '\''self'\'' '\''unsafe-inline'\'';";' >> /etc/nginx/conf.d/security.conf

# Set proper permissions
RUN chown -R nginxuser:nginxgroup /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Configure health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/health || exit 1

# Set container labels
LABEL maintainer="CRM Development Team" \
      version="1.0.0" \
      description="Multi-tenant CRM Frontend Application" \
      security.protocol="production-grade" \
      tenant.enabled="true" \
      monitoring.enabled="true"

# Expose port
EXPOSE 80

# Switch to non-root user
USER nginxuser

# Set security options
SECURITY_OPTS --no-new-privileges:true --seccomp=unconfined

# Drop all capabilities
DROP_CAPABILITIES ALL

# Enable read-only filesystem
VOLUME ["/var/cache/nginx", "/var/run"]
READONLY true

# Start nginx
CMD ["nginx", "-g", "daemon off;"]