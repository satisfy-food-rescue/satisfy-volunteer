# Production image for Coolify (or any Docker host).
# The SQLite database lives on a volume at /data; the container creates and
# seeds it on first boot and reseeds when the NZ date rolls over.

FROM node:25-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /app

FROM base AS build
# Toolchain for better-sqlite3 if no prebuilt binary matches.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 \
  DATABASE_URL=file:/data/satisfy.db
# The seed and schema push need tsx and the Prisma CLI at runtime, so the full
# install is kept. Fine for a demo; revisit with Postgres and migrations.
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /data && chown node:node /data
USER node
# Cache pnpm now so boot does not download it.
RUN COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --version
VOLUME /data
EXPOSE 3000
CMD ["pnpm", "start:prod"]
