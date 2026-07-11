# WallBang.xyz

Production marketing foundation for the WallBang Counter-Strike 2 competitive platform.

## Stack

- Next.js 15 (App Router) · React 19 · TypeScript (strict)
- Tailwind CSS · shadcn/ui · Framer Motion (minimal)
- React Hook Form · Zod · Lucide
- MDX blog via `content/blog`
- `output: "standalone"` for VPS / Docker portability

## Scripts

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```

## Environment

Copy `.env.example` to `.env.local`:

```bash
NEXT_PUBLIC_SITE_URL=https://wallbang.xyz
NEXT_PUBLIC_DISCORD_URL=https://discord.gg/zE2Xvhgyq5
```

## Deployment (Oracle Ubuntu + Nginx)

1. Build on CI or the VPS: `npm ci && npm run build`
2. Run the standalone server from `.next/standalone` (or Docker later)
3. Reverse-proxy with Nginx to `127.0.0.1:3000`
4. Point `wallbang.xyz` DNS at the VPS

See `nginx/wallbang.xyz.conf.example` for a starting proxy config.

## Architecture notes

- Marketing routes live under `app/(marketing)`
- API abstractions in `lib/api` (waitlist is mocked)
- Feature flags in `config/features.flags.ts` for future auth/dashboard modules
- SEO helpers in `seo/`
