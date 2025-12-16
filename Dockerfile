# syntax=docker/dockerfile:1

# ---- Base ----
FROM node:22-alpine AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
# Add libc6-compat for Alpine compatibility with some npm packages
RUN apk add --no-cache libc6-compat

# Copy package files and .npmrc for legacy-peer-deps
COPY package.json package-lock.json* .npmrc ./

# Install dependencies
RUN npm ci

# ---- Builder ----
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments for public env vars needed at build time
ARG NEXT_PUBLIC_PROJECT_ID
ARG NEXT_PUBLIC_ETH_MAIN_API_KEY
ARG NEXT_PUBLIC_MATIC_MAIN_API_KEY
ARG NEXT_PUBLIC_ARB_MAIN_API_KEY
ARG NEXT_PUBLIC_OPT_MAIN_API_KEY
ARG NEXT_PUBLIC_BASE_MAIN_API_KEY
ARG NEXT_PUBLIC_NEYNAR_API_KEY
ARG NEXT_PUBLIC_AIRSTACK_KEY

# Set as environment variables for the build
ENV NEXT_PUBLIC_PROJECT_ID=$NEXT_PUBLIC_PROJECT_ID
ENV NEXT_PUBLIC_ETH_MAIN_API_KEY=$NEXT_PUBLIC_ETH_MAIN_API_KEY
ENV NEXT_PUBLIC_MATIC_MAIN_API_KEY=$NEXT_PUBLIC_MATIC_MAIN_API_KEY
ENV NEXT_PUBLIC_ARB_MAIN_API_KEY=$NEXT_PUBLIC_ARB_MAIN_API_KEY
ENV NEXT_PUBLIC_OPT_MAIN_API_KEY=$NEXT_PUBLIC_OPT_MAIN_API_KEY
ENV NEXT_PUBLIC_BASE_MAIN_API_KEY=$NEXT_PUBLIC_BASE_MAIN_API_KEY
ENV NEXT_PUBLIC_NEYNAR_API_KEY=$NEXT_PUBLIC_NEYNAR_API_KEY
ENV NEXT_PUBLIC_AIRSTACK_KEY=$NEXT_PUBLIC_AIRSTACK_KEY

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- Runner ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Set correct permissions for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
