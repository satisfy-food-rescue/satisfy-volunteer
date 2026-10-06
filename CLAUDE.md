# CLAUDE.md

Guidance for agents working in this repository. Read README.md first; this file covers the rules that are easy to get wrong.

## This is Next.js 16

APIs and conventions differ from older Next.js (for example `src/proxy.ts` replaces middleware). Check `node_modules/next/dist/docs/` before writing routing, caching or data-fetching code.

## Rules

- **Deployment is Coolify, not Vercel.** No Vercel-only APIs. Everything must work in the standalone Docker image.
- **No `NEXT_PUBLIC_` configuration.** Settings are read at runtime through `env()` in `src/lib/env.ts` so one image serves production and the demo. Add new settings there (validated) and to `.env.example`, `DEPLOY.md` and the CI/e2e env if relevant.
- **Prisma**: import from `@/generated/prisma/client` (types) or `@/lib/db` (the client), never `@prisma/client`. Enums come from the schema; labels for every enum value live in `src/lib/domain.ts`. Schema changes need a migration (`pnpm db:migrate --name …`); keep migrations additive.
- **Dates**: calendar days are `@db.Date` and handled as `YYYY-MM-DD` strings with `src/lib/dates.ts`; "today" is always Pacific/Auckland (`todayISO()`), never `new Date().toISOString()`.
- **Guards**: every page and server action under `/app` or `/admin` calls `requireVolunteer()` or `requireAdmin()`. The proxy is only a convenience redirect.
- **Email**: never call the mailer directly. Use `queueEmail()` (logged, delivered after the response, retried) with a template from `src/lib/email-templates.ts`; give automated messages a `ref` so they are sent once. Sign-in links go through `sendSignInLink()` and are never stored.
- **Demo mode**: anything demo-only checks `isDemo()`. Production UI must never claim something that only happens in the demo (sync, mocks, personas).
- **Mutations** are server actions validated with Zod, returning `ActionResult` and calling `revalidatePath`.
- **Admin layout** responds to its container (`@container/admin`), not the window: use `@4xl/admin:` rather than `lg:` for page layouts under `/admin`.
- **Writing style** (UI copy, comments, docs): plain New Zealand English, no em dashes. Te reo greetings in volunteer emails (Kia ora, Ngā mihi nui) are intentional.

## Checks before a PR

`pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm test:e2e` (the last two need `docker compose up -d db`).
