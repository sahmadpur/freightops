# FreightOps

Web platform for a freight forwarding company. See `docs/brd.md` (requirements)
and `docs/superpowers/specs/2026-06-12-freightops-platform-design.md` (design).

## Development

Everything runs in Docker — no local Node required:

    cp .env.example .env          # first time: set BETTER_AUTH_SECRET (openssl rand -base64 32)
    docker compose up -d          # postgres + minio + app-dev (hot reload on port 3000)
    docker compose exec app-dev npm run db:seed   # first time: creates admin@freightops.local / admin12345

The `app-dev` service bind-mounts the source, installs dependencies and runs
migrations on start, and serves `next dev` with hot reload. Its `node_modules`
and build artifacts live in named volumes, separate from any host copies.
You can still `npm install` locally for IDE type support.

Public sign-up is disabled; users are created via the seed script or staff invitations.

## Production (single VPS)

    docker compose --profile full up -d --build

The app container runs database migrations on start and serves on port 3000.

## Scripts

- `npm run db:generate` / `db:migrate` / `db:studio` — Drizzle migrations
- `npm run db:seed` — seed the initial admin user
- `npm test` — unit tests (Vitest)
- `npx tsx --env-file=.env scripts/check-schema.mts` — schema smoke test

## Stack

Next.js (App Router) · Drizzle ORM + Postgres · Better Auth · next-intl (EN/RU/AZ) · MinIO · Docker Compose
