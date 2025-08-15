# Multi-stage Dockerfile for Next.js Frontend with Technical Excellence
# Stage 1: Dependencies
FROM node:18.19.0-alpine AS dependencies

# Install system dependencies for building native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files and ensure scripts directory exists
COPY package.json package-lock.json ./
# Create scripts directory and copy setup scripts
RUN mkdir -p scripts
COPY scripts ./scripts

# Install dependencies with memory optimization (disable Husky for Docker)
ENV HUSKY=0
RUN npm pkg delete scripts.prepare \
    && npm ci --omit=dev \
    && npm cache clean --force

# Stage 2: Development Dependencies
FROM dependencies AS dev-dependencies

# Install all dependencies including devDependencies
RUN npm ci \
    && npm cache clean --force

# Stage 3: Builder
FROM dev-dependencies AS builder

WORKDIR /app

# Copy application source
COPY . .

# Ensure scripts directory exists and setup Tesseract.js worker files
RUN mkdir -p scripts && \
    if [ -f scripts/setup-tesseract-lazy.js ]; then \
      node scripts/setup-tesseract-lazy.js; \
    else \
      echo "Creating placeholder tesseract setup..." && \
      mkdir -p public/tesseract && \
      echo 'Tesseract will be loaded dynamically when needed' > public/tesseract/.needs-setup; \
    fi

# Set build-time environment variables
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Stage 4: Production Runtime
FROM node:18.19.0-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy built application from builder
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy production dependencies including zustand
COPY --from=dependencies --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy Tesseract.js worker files
COPY --from=builder --chown=nextjs:nodejs /app/public/tesseract ./public/tesseract
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tesseract.js/dist/worker.min.js ./public/tesseract/
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tesseract.js-core/tesseract-core-simd.wasm ./public/tesseract/
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tesseract.js-core/tesseract-core.wasm ./public/tesseract/

# Create necessary directories
RUN mkdir -p .next/cache && \
    chown -R nextjs:nodejs .next

# Health check configuration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js

# Create health check script
RUN echo "const http = require('http'); \
    const options = { \
      host: 'localhost', \
      port: 3000, \
      path: '/api/health', \
      timeout: 2000 \
    }; \
    const req = http.request(options, (res) => { \
      process.exit(res.statusCode === 200 ? 0 : 1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.end();" > healthcheck.js && \
    chown nextjs:nodejs healthcheck.js

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]

# Stage 5: Development
FROM dev-dependencies AS development

WORKDIR /app

# Install development tools
RUN apk add --no-cache \
    git \
    vim \
    && rm -rf /var/cache/apk/*

# Copy source code
COPY . .

# Setup Tesseract.js for development
RUN node scripts/setup-tesseract-lazy.js

# Expose ports for development
EXPOSE 3000
EXPOSE 9229

# Environment for development
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Development command with hot reload
CMD ["npm", "run", "dev"]