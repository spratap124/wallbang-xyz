# Multi-stage Dockerfile for Oracle Always Free / Docker deployment.
# Builds the Next.js standalone output and runs it on Node 22 Alpine.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined at build time — pass via Compose build.args.
ARG NEXT_PUBLIC_SITE_URL=https://wallbang.xyz
ARG NEXT_PUBLIC_DISCORD_URL=https://discord.gg/KY2dRw8Yh4
ARG NEXT_PUBLIC_RETAKE_HOST=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_DISCORD_URL=$NEXT_PUBLIC_DISCORD_URL
ENV NEXT_PUBLIC_RETAKE_HOST=$NEXT_PUBLIC_RETAKE_HOST
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# wget is used by the Compose healthcheck.
RUN apk add --no-cache wget \
  && addgroup -S nodejs \
  && adduser -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
