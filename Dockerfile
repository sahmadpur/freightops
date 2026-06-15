FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Dummy values at build time: auth.ts throws if BETTER_AUTH_SECRET is absent,
# db/index.ts opens a postgres connection on module load, and s3.ts throws when
# the S3_* vars are absent (the documents API route is evaluated during page-data
# collection). The S3 client is constructed lazily, so dummy values are safe.
# All of these are replaced by real env vars at runtime.
ARG DATABASE_URL=postgres://dummy:dummy@localhost:5432/dummy
ARG BETTER_AUTH_SECRET=build-time-dummy-secret-32chars!!
ENV DATABASE_URL=$DATABASE_URL
ENV BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET
ENV S3_ENDPOINT=http://localhost:9000
ENV S3_ACCESS_KEY=build-time-dummy
ENV S3_SECRET_KEY=build-time-dummy
RUN npm run build

# Separate stage: install drizzle-kit and its runtime deps for the target platform.
# drizzle-kit needs esbuild (platform-specific binary), drizzle-orm, and the postgres
# driver. We install the full project deps then drizzle-kit on top to get matching versions.
FROM node:24-alpine AS migrate-deps
WORKDIR /migrate
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Next.js standalone server.js binds to $HOSTNAME; Docker otherwise sets it to the
# container id, binding a single interface. Bind all interfaces so a reverse proxy
# (Traefik) can reach the app. PORT keeps the listen port explicit.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --chown=node:node --from=build /app/.next/standalone ./
COPY --chown=node:node --from=build /app/.next/static ./.next/static
COPY --chown=node:node --from=build /app/public ./public
COPY --chown=node:node --from=build /app/drizzle ./drizzle
COPY --chown=node:node --from=build /app/drizzle.config.ts ./
# Copy drizzle-kit + its deps (esbuild with linux binaries, drizzle-orm, postgres driver)
COPY --chown=node:node --from=migrate-deps /migrate/node_modules/drizzle-kit ./node_modules/drizzle-kit
COPY --chown=node:node --from=migrate-deps /migrate/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --chown=node:node --from=migrate-deps /migrate/node_modules/esbuild ./node_modules/esbuild
COPY --chown=node:node --from=migrate-deps /migrate/node_modules/@esbuild ./node_modules/@esbuild
COPY --chown=node:node --from=migrate-deps /migrate/node_modules/postgres ./node_modules/postgres
USER node
EXPOSE 3000
# Use node directly on bin.cjs to avoid npx attempting a network download
CMD ["sh", "-c", "node node_modules/drizzle-kit/bin.cjs migrate && node server.js"]
