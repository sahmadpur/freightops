# FreightOps

Web platform for a freight forwarding company. See `docs/brd.md` (requirements)
and `docs/superpowers/specs/2026-06-12-freightops-platform-design.md` (design).

## Development

    docker compose up -d          # postgres + minio
    cp .env.example .env          # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
    npm install
    npm run db:migrate
    npm run db:seed               # creates admin@freightops.local / admin12345
    npm run dev

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
