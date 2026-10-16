# ==============================================================================
# NovaCare Hospital Management System - Production Dockerfile
# Multi-stage lean build for high-performance deployment
# ==============================================================================

FROM node:22-alpine AS base

# Install necessary build tools for native addons
RUN apk add --no-cache python3 make g++ curl

WORKDIR /usr/src/app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Set container user permissions for security
RUN chown -R node:node /usr/src/app
USER node

# Production environment variables defaults
ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0

EXPOSE 5000

# Docker Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "server.js"]
