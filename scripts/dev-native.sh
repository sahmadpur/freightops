#!/usr/bin/env bash
#
# Start the full dev stack natively, without Docker.
#
# The documented dev flow is `docker compose up -d` (see README) — use that
# when you have a Docker daemon. This script is for environments that don't,
# such as a code-server / devcontainer instance with no daemon and no mounted
# docker.sock, where Postgres, MinIO and Mailpit run as ordinary host services.
#
# Expects (Debian/Ubuntu package names):
#   postgresql            apt-get install postgresql
#   node + npm            >= 20.9 (Next 16)
#   minio, mailpit        optional single binaries on PATH; skipped if absent
#   chromium              optional, for invoice/ACT PDF generation
#
# Services already running are left alone, so this is safe to re-run.
#
# Usage:  ./scripts/dev-native.sh [-- <extra next dev args>]
# Env:    HOST (default 0.0.0.0)  PORT (default 3000)
#         MINIO_DATA_DIR (default ~/.local/share/freightops-minio)
#         LOG_DIR (default /tmp/freightops-logs)
#         SKIP_MIGRATE=1 to skip drizzle migrations

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-3000}"
MINIO_DATA_DIR="${MINIO_DATA_DIR:-$HOME/.local/share/freightops-minio}"
LOG_DIR="${LOG_DIR:-/tmp/freightops-logs}"
mkdir -p "$LOG_DIR"

info() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m warn\033[0m %s\n' "$1"; }
die()  { printf '\033[1;31m error\033[0m %s\n' "$1" >&2; exit 1; }

[ -f .env ] || die ".env is missing — copy .env.example to .env and set BETTER_AUTH_SECRET (openssl rand -base64 32)"
command -v node >/dev/null || die "node is not installed"

# --- Postgres -------------------------------------------------------------
# Container images have no systemd, so drive the cluster with pg_ctlcluster.
if command -v pg_lsclusters >/dev/null; then
  # Field 1 is the major version, field 4 the status; take the first cluster.
  read -r PG_VER PG_CLUSTER PG_STATUS < <(pg_lsclusters --no-header 2>/dev/null | awk 'NR==1 {print $1, $2, $4}')
  if [ -z "${PG_VER:-}" ]; then
    die "no Postgres cluster found — install postgresql, or start your own and re-run"
  elif [ "$PG_STATUS" = "online" ]; then
    info "postgres $PG_VER/$PG_CLUSTER already online"
  else
    info "starting postgres $PG_VER/$PG_CLUSTER"
    sudo pg_ctlcluster "$PG_VER" "$PG_CLUSTER" start
  fi

  # Migrations fail against a cluster that is up but not yet accepting queries.
  for _ in $(seq 1 30); do
    pg_isready -q && break
    sleep 1
  done
  pg_isready -q || die "postgres did not become ready in 30s"
else
  warn "pg_lsclusters not found — assuming Postgres is managed elsewhere"
fi

# --- MinIO (S3 for document uploads) --------------------------------------
if command -v minio >/dev/null; then
  if pgrep -f "minio server" >/dev/null; then
    info "minio already running"
  else
    info "starting minio (api :9000, console :9001)"
    mkdir -p "$MINIO_DATA_DIR"
    MINIO_ROOT_USER="${S3_ACCESS_KEY:-freightops}" \
    MINIO_ROOT_PASSWORD="${S3_SECRET_KEY:-freightops_dev}" \
      nohup minio server "$MINIO_DATA_DIR" --console-address ":9001" \
      >"$LOG_DIR/minio.log" 2>&1 &
  fi
else
  warn "minio not on PATH — document uploads will fail"
fi

# --- Mailpit (SMTP sink) --------------------------------------------------
if command -v mailpit >/dev/null; then
  if pgrep -x mailpit >/dev/null; then
    info "mailpit already running"
  else
    info "starting mailpit (smtp :1025, ui :8025)"
    nohup mailpit --max 500 >"$LOG_DIR/mailpit.log" 2>&1 &
  fi
else
  warn "mailpit not on PATH — outbound mail will fail"
fi

# --- App ------------------------------------------------------------------
[ -d node_modules ] || { info "installing dependencies"; npm install; }

if [ "${SKIP_MIGRATE:-}" != "1" ]; then
  info "running migrations"
  npm run db:migrate
fi

info "starting next dev on $HOST:$PORT  (logs: $LOG_DIR)"
exec npx next dev -H "$HOST" -p "$PORT" "$@"
