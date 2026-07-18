# Multi-stage production image for WallBang Next.js (SSR + API).
# Aligns with the Hostinger KVM2 Docker executive summary.

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* are inlined at build time — pass via Compose build.args.
ARG NEXT_PUBLIC_SITE_URL=https://wallbang.xyz
ARG NEXT_PUBLIC_DISCORD_URL=https://discord.gg/KY2dRw8Yh4
ARG NEXT_PUBLIC_RETAKE_HOST=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_DISCORD_URL=$NEXT_PUBLIC_DISCORD_URL
ENV NEXT_PUBLIC_RETAKE_HOST=$NEXT_PUBLIC_RETAKE_HOST
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache wget \
  && addgroup -S wallbang \
  && adduser -S -G wallbang wallbang

COPY --from=builder /app/public ./public
COPY --from=builder --chown=wallbang:wallbang /app/.next/standalone ./
COPY --from=builder --chown=wallbang:wallbang /app/.next/static ./.next/static

USER wallbang
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
