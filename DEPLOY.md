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

## Email

The notification worker sends to the internal **Mailpit** sink by default —
invitations/alerts are captured but not delivered. Point `SMTP_*` in `.env` at a
real MTA to deliver mail, then `docker compose -f docker-compose.prod.yml up -d`.
