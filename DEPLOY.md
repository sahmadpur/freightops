# Self-hosted deployment (single Docker stack)

One compose stack (`freightops`) runs Postgres, MinIO, Mailpit and the Next.js
app. Routing matches the other apps on the server (saleswind, docai):

```
Browser ──HTTPS──> Cloudflare ──tunnel──> cloudflared (host)
                                              │  http://localhost:80
                                              ▼
                                          Traefik ──Host()──> freightops-app
                                                                  │ (internal network)
                                                                  ├─> freightops-db
                                                                  ├─> freightops-minio
                                                                  └─> freightops-mailpit
```

- `freightops-db` / `-minio` / `-mailpit` are **internal only** (not published).
- `freightops-app` joins the shared **`proxy`** network and is routed by Traefik
  via the `Host()` label. Cloudflare terminates TLS.

## Deploy

```bash
cd /home/freightops && git pull          # or: initial clone/upload
cp .env.prod.example .env                 # first time only — fill in secrets
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f app
```

Migrations run automatically on app start (`drizzle-kit migrate`, see Dockerfile).

`.env` values:
- `APP_HOST` — hostname (`freightops.cybercraft.az`), must match the Cloudflare
  public hostname / Traefik route.
- `POSTGRES_PASSWORD` and the password inside `DATABASE_URL` must be identical.
- `BETTER_AUTH_SECRET` — `openssl rand -base64 32`.
- `STACK` — leave unset for the primary instance; set for parallel instances
  (see below).

## First admin (run once, after the stack is up)

The seed isn't part of app startup. Run it in a throwaway container on the
stack's network (reuses the repo's seed script):

```bash
docker run --rm --network freightops_default --env-file /home/freightops/.env \
  -v /home/freightops:/app -w /app node:24-alpine \
  sh -c "npm ci --no-audit --no-fund && npx tsx scripts/seed-admin.mts"
```

Sign in at `https://freightops.cybercraft.az` with `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD`. Change the password after first login.

## Cloudflare Tunnel (dashboard-managed)

Zero Trust → Networks → Tunnels → *tunnel* → Public Hostname → **Add**:
- Subdomain/domain: same as `APP_HOST`
- Service: `HTTP` → `localhost:80` (Traefik)

## Parallel instance (second subdomain, same server)

The whole stack is namespaced by `STACK` (compose project, containers, volumes,
image tag, Traefik router — default `freightops`). A second checkout with a
different `STACK` runs a fully independent copy: own network, own Postgres/MinIO
volumes, empty database.

```bash
git clone <repo> /home/freightops2          # separate checkout, any dir name
cd /home/freightops2
cp .env.prod.example .env
```

In the new `.env`, set at minimum:
- `STACK=freightops2` — unique per instance; **never change it later** (volumes
  are named after it — changing it orphans the instance's data).
- `APP_HOST=freightops2.cybercraft.az` — the new subdomain.
- Fresh `POSTGRES_PASSWORD` / `DATABASE_URL` password, `BETTER_AUTH_SECRET`,
  `S3_SECRET_KEY`, seed admin credentials.

Then bring it up and route it:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

- Cloudflare: add a Public Hostname for the new subdomain → `HTTP` →
  `localhost:80` (same tunnel; Traefik routes by `Host()`).
- Seed the first admin with the same command as above, substituting the
  checkout dir and the network name `freightops2_default`.

The instances share nothing — deploying/stopping one never touches the other.
Traefik picks the new router up from container labels automatically.

## Evaluation instance for a third party

An evaluation instance must not expose another customer's data. Deploy it as a
parallel instance (above) and check all four:

1. **Fresh stack** — a unique `STACK` gives it its own Postgres and MinIO
   volumes. Never point a test instance at an existing `DATABASE_URL` or reuse
   the production `S3_*` credentials.
2. **No issuer requisites** — leave every `ISSUER_*` (and
   `ISSUER_LOGO_DATA_URI`) unset in the instance's `.env`. Generated invoices
   and ACTs then print neutral placeholders instead of the production
   customer's company, VÖEN, bank account and signatory.
3. **Own secrets** — fresh `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`,
   `S3_SECRET_KEY`, and seed admin credentials.
4. **Mail stays internal** — leave `SMTP_*` on the built-in Mailpit sink so
   invitations from the test instance are captured, not delivered.

Fill it with demo content (fictional accounts, carriers, orders) instead of
real records:

```bash
docker run --rm --network <stack>_default --env-file /home/<checkout>/.env \
  -v /home/<checkout>:/app -w /app node:24-alpine \
  sh -c "npm ci --no-audit --no-fund && npx tsx scripts/seed-demo.mts"
```

The production instance keeps its real requisites in its own `.env` only — see
`deploy/issuer.prod.env` (git-ignored, copy it to the production server once).

## Email

The notification worker sends to the internal **Mailpit** sink by default —
invitations/alerts are captured but not delivered. Point `SMTP_*` in `.env` at a
real MTA to deliver mail, then `docker compose -f docker-compose.prod.yml up -d`.
