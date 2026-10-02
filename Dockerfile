# Multi-stage production Dockerfile for Cogito
# Stage 1: Builder
FROM node:20-bookworm-slim AS builder

WORKDIR /build

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source and build configurations
COPY tsconfig.json vite.config.ts postcss.config.js tailwind.config.js index.html ./
COPY src/ ./src/

# Compile TypeScript and bundle frontend dashboard
RUN npm run build

# Stage 2: Production runtime (minimal, secure, non-root)
FROM node:20-bookworm-slim AS runner

# Install git and ca-certificates (required by Cogito git integration and exporters)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

WORKDIR /app

# Copy package manifests and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built artifacts and required runtime templates/schemas from builder
COPY --from=builder /build/dist ./dist
COPY bin ./bin
COPY templates ./templates
COPY schema ./schema
COPY README.md LICENSE ./

# Ensure correct executable permissions
RUN chmod +x bin/cogito.js bin/decision-tracker.js

# Link binary globally inside container
RUN npm link

# Prepare app workspace and configure non-root user
WORKDIR /workspace
RUN chown -R node:node /workspace /app

# Switch to standard non-root node user
USER node

# Expose web dashboard port
EXPOSE 3333

# Default entrypoint runs the CLI
ENTRYPOINT ["cogito"]
CMD ["--help"]
