# Production-ready multi-stage Dockerfile for Next.js Frontend
# Security-hardened with Alpine Linux, non-root user, and minimal attack surface

# Stage 1: Dependencies - Install base packages and Node.js modules
FROM node:18.20.4-alpine AS dependencies

# Security: Use specific user/group IDs for consistency
ARG USER_ID=1001
ARG GROUP_ID=1001
ARG BUILD_VERSION="unknown"
ARG BUILD_DATE
ARG VCS_REF

# Security: Install security updates and minimal build dependencies
RUN apk upgrade --no-cache && \
    apk add --no-cache \
        # Build tools (removed after build)
        python3 \
        make \
        g++ \
        pkgconfig \
        # Image processing libraries
        cairo-dev \
        jpeg-dev \
        pango-dev \
        giflib-dev \
        # Security tools
        ca-certificates \
        dumb-init \
    && rm -rf /var/cache/apk/* /tmp/* /var/tmp/*

# Security: Set secure working directory
WORKDIR /app

# Performance: Copy package files for better Docker layer caching
COPY --chown=root:root package.json package-lock.json ./

# Security: Create scripts directory with proper permissions
RUN mkdir -p scripts
COPY --chown=root:root scripts ./scripts

# Performance: Install production dependencies with security and optimization
ENV HUSKY=0 \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_AUDIT=false

RUN npm pkg delete scripts.prepare \
    && npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force \
    && rm -rf /tmp/* /var/tmp/*

# Stage 2: Development Dependencies - Include build tools
FROM dependencies AS dev-dependencies

# Performance: Install all dependencies for building
RUN npm ci --no-audit --no-fund \
    && npm cache clean --force \
    && rm -rf /tmp/* /var/tmp/*

# Stage 3: Builder - Compile and optimize application
FROM dev-dependencies AS builder

WORKDIR /app

# Security: Copy source code with restricted permissions
COPY --chown=root:root . .

# Performance: Setup Tesseract.js with error handling
RUN mkdir -p scripts public/tesseract && \
    if [ -f scripts/setup-tesseract-lazy.js ]; then \
        node scripts/setup-tesseract-lazy.js || echo "Tesseract setup failed, using fallback"; \
    fi && \
    if [ ! -d public/tesseract ] || [ -z "$(ls -A public/tesseract 2>/dev/null)" ]; then \
        echo "Creating tesseract fallback..." && \
        mkdir -p public/tesseract && \
        echo 'Tesseract will be loaded dynamically when needed' > public/tesseract/.needs-setup; \
    fi

# Security: Set build-time environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_ENV=production

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV} \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=4096"

# Performance: Build with optimizations
RUN npm run build && \
    npm prune --production && \
    npm cache clean --force && \
    rm -rf /tmp/* /var/tmp/* .next/cache/webpack

# Stage 4: Production Runtime - Minimal secure runtime environment
FROM node:18.20.4-alpine AS production

# Security: Install only runtime dependencies and dumb-init for signal handling
RUN apk upgrade --no-cache && \
    apk add --no-cache dumb-init ca-certificates && \
    rm -rf /var/cache/apk/* /tmp/* /var/tmp/*

# Security: Create non-root user with specific IDs
RUN addgroup -g ${GROUP_ID:-1001} -S nodejs && \
    adduser -S nextjs -u ${USER_ID:-1001} -G nodejs

WORKDIR /app

# Security: Set production environment variables
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0" \
    NODE_OPTIONS="--unhandled-rejections=strict"

# Performance: Copy built application with optimal file structure
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Security: Copy only required production dependencies
COPY --from=dependencies --chown=nextjs:nodejs /app/node_modules ./node_modules

# Performance: Copy Tesseract.js assets with error handling
RUN mkdir -p public/tesseract
COPY --from=builder --chown=nextjs:nodejs /app/public/tesseract ./public/tesseract

# Security: Copy Tesseract worker files if they exist
RUN if [ -f /app/node_modules/tesseract.js/dist/worker.min.js ]; then \
        cp /app/node_modules/tesseract.js/dist/worker.min.js ./public/tesseract/ 2>/dev/null || true; \
    fi && \
    if [ -f /app/node_modules/tesseract.js-core/tesseract-core-simd.wasm ]; then \
        cp /app/node_modules/tesseract.js-core/tesseract-core-simd.wasm ./public/tesseract/ 2>/dev/null || true; \
    fi && \
    if [ -f /app/node_modules/tesseract.js-core/tesseract-core.wasm ]; then \
        cp /app/node_modules/tesseract.js-core/tesseract-core.wasm ./public/tesseract/ 2>/dev/null || true; \
    fi

# Security: Create required directories with minimal permissions
RUN mkdir -p .next/cache && \
    chown -R nextjs:nodejs .next && \
    chmod -R 755 .next

# Security: Create comprehensive health check script
RUN echo '#!/bin/sh\n\
set -e\n\
node -e "\n\
const http = require(\"http\");\n\
const options = {\n\
  host: \"localhost\",\n\
  port: 3000,\n\
  path: \"/api/health\",\n\
  timeout: 5000,\n\
  method: \"GET\"\n\
};\n\
const req = http.request(options, (res) => {\n\
  let data = \"\";\n\
  res.on(\"data\", chunk => data += chunk);\n\
  res.on(\"end\", () => {\n\
    if (res.statusCode === 200) {\n\
      console.log(\"Health check passed\");\n\
      process.exit(0);\n\
    } else {\n\
      console.error(\"Health check failed with status:\", res.statusCode);\n\
      process.exit(1);\n\
    }\n\
  });\n\
});\n\
req.on(\"error\", (err) => {\n\
  console.error(\"Health check error:\", err.message);\n\
  process.exit(1);\n\
});\n\
req.on(\"timeout\", () => {\n\
  console.error(\"Health check timeout\");\n\
  req.destroy();\n\
  process.exit(1);\n\
});\n\
req.setTimeout(5000);\n\
req.end();\n\
"' > /usr/local/bin/healthcheck.sh && \
    chmod +x /usr/local/bin/healthcheck.sh

# Security: Health check with proper timeout and retry logic
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh

# Security: Add metadata labels
LABEL maintainer="Omni Portal Team" \
      version="${BUILD_VERSION:-unknown}" \
      build-date="${BUILD_DATE}" \
      vcs-ref="${VCS_REF}" \
      description="Omni Portal Next.js Frontend - Production Ready"

# Security: Switch to non-root user
USER nextjs:nodejs

# Security: Expose only required port
EXPOSE 3000

# Security: Use dumb-init for proper signal handling and exec form
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]

# Stage 5: Development - Debug-enabled environment (NOT for production)
FROM dev-dependencies AS development

# Security warning: This stage is for development only
LABEL environment="development" \
      security-warning="This image contains debug tools and should NOT be used in production"

WORKDIR /app

# Development: Install debugging and development tools
RUN apk add --no-cache \
        git \
        vim \
        curl \
        net-tools \
    && rm -rf /var/cache/apk/* /tmp/* /var/tmp/*

# Security: Copy source code
COPY --chown=root:root . .

# Development: Setup Tesseract.js with error handling
RUN node scripts/setup-tesseract-lazy.js || echo "Tesseract setup failed in development mode"

# Development: Create non-root user for development
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs && \
    chown -R nextjs:nodejs /app

USER nextjs:nodejs

# Development: Expose ports for development and debugging
EXPOSE 3000 9229

# Development: Set development environment
ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_APP_ENV=development

# Development: Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "dev"]