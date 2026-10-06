# syntax=docker/dockerfile:1.7
# Production image for Coolify (or any Docker host). One image serves both
# production and the sales demo; DEMO_MODE and the other settings are runtime
# environment variables (see .env.example), so nothing is baked in at build.
#
# On start the container applies pending migrations, then starts Next.js,
# whose instrumentation hook bootstraps the database (src/lib/bootstrap.ts).

FROM node:24-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat && corepack enable
WORKDIR /app

# ---- deps: full install (the Prisma CLI is a dev dependency)
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# ---- build: Prisma client + Next.js standalone bundle
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---- migrator: just the Prisma CLI, at exactly the version the app uses
FROM base AS migrator
WORKDIR /opt/migrator
COPY package.json /tmp/package.json
RUN PRISMA=$(node -p "require('/tmp/package.json').devDependencies.prisma") \
 && DOTENV=$(node -p "require('/tmp/package.json').devDependencies.dotenv") \
 && npm init -y >/dev/null \
 && npm install --omit=optional --no-package-lock --no-audit --no-fund "prisma@$PRISMA" "dotenv@$DOTENV"

# ---- runtime
FROM node:24-alpine AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# openssl for the Prisma schema engine during `migrate deploy`.
RUN apk add --no-cache openssl \
 && addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs
WORKDIR /app
COPY --from=migrator --chown=nextjs:nodejs /opt/migrator /opt/migrator
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=nextjs:nodejs /app/scripts ./scripts
ENV NODE_PATH=/opt/migrator/node_modules PATH=/opt/migrator/node_modules/.bin:$PATH
USER nextjs
EXPOSE 3000

# Liveness only (no database), so a Postgres blip does not restart the app.
# start-period covers migrations and boot.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# exec hands PID 1 to Node, so SIGTERM on redeploy lets in-flight requests and
# after() email deliveries finish.
CMD ["sh", "-c", "prisma migrate deploy && exec node server.js"]
