# WallBang.xyz agent guide

## Project overview

WallBang is a Next.js 15 App Router application for the WallBang CS2 platform.
It includes public marketing pages, authenticated player features, staff
administration, game-server APIs, and MongoDB-backed services.

## Layout

- `app/(marketing)/` — public pages and player-facing account pages.
- `app/(admin)/` — authenticated staff dashboard pages.
- `app/api/` — route handlers. Keep public, staff, and game-plugin access
  controls explicit.
- `components/` — UI components. Admin components live in
  `components/admin/`.
- `lib/` — server-side domain services, auth, database access, and shared
  helpers.
- `types/` — TypeScript domain types.
- `config/` — navigation, feature flags, server registry, and site settings.
- `docs/` — implementation and deployment documentation.

Use the `@/` import alias for repository-root imports.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run test:moderation
```

Run the narrowest relevant check after a change. Run `npm run lint` and
`npm run typecheck` for TypeScript or UI changes when practical.
Before creating a pull request, always run `npm run build` locally and resolve
any build failures.

## Application conventions

- Use server components by default. Add `"use client"` only for browser state,
  event handlers, or browser APIs.
- Build page metadata with `createPageMetadata` from `seo/metadata.ts`.
- Use shared UI primitives in `components/ui/` and shared layout primitives in
  `components/shared/` before adding new patterns.
- Keep public pages responsive. Tables need a usable mobile presentation.
- Use `next/link` for internal navigation and `next/image` where configured;
  existing Steam avatar UI may use plain `<img>` because avatar hosts vary.

## Authentication, authorization, and APIs

- Route handlers must check `isMongoConfigured()` before MongoDB access.
- Staff endpoints use `requirePermission(...)`; do not rely on client-side
  controls for authorization.
- CS2 plugin endpoints use `requirePluginApiKey(...)` and validate the
  `x-server-id` against the server registry when server-scoped.
- Validate route input with Zod and return API envelopes through `jsonOk` and
  `jsonError`.
- Treat SteamIDs as sensitive identifiers. Do not expose them on public pages
  unless the product requirement explicitly calls for it.

## Moderation and Steam profiles

- Bans and reports are stored in `player_bans` and `player_reports`.
- A time-bound ban remains stored after expiry. Enforcement uses
  `isBanCurrentlyActive`, which checks `expiresAt` at read time.
- A revoked ban is retained as history with `status: "revoked"` and revocation
  metadata.
- Use `fetchSteamPlayerSummaries` only to read public Steam profile data for
  an existing SteamID. It must never create a record in the `users` collection.
- A player is a registered WallBang user only when a `users` collection record
  exists. Reports, bans, and profile lookups must not register players.
- Public moderation views must use presentation-safe data and exclude internal
  IDs and SteamIDs unless expressly required.

## Data and deployment safety

- Do not commit `.env`, credentials, tokens, database dumps, or production
  certificates.
- Avoid destructive database operations and production deployment commands
  unless the user explicitly asks for them.
- CS2 runs outside Docker Compose on the production host. Do not change its
  deployment assumptions while editing the web application.

## Git

- Preserve unrelated working-tree changes.
- Use branches prefixed with `codex/` unless the user specifies another name.
- Keep commits focused and use conventional-style messages such as
  `feat:`, `fix:`, or `docs:`.
