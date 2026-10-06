# Satisfy Volunteers

Volunteer management for Satisfy Food Rescue (Rangiora, North Canterbury), built by Awhina Tech. Two surfaces in one codebase: a mobile-first volunteer app (`/app`) and a desktop coordinator admin (`/admin`). Volunteers book shifts and cover gaps, keep their training current and mark themselves away; coordinators run the roster, training, applications and communication.

The same code runs production and the sales demo. `DEMO_MODE=1` turns on the persona picker, regenerates demo data every day and sends nothing. See [DEMO.md](DEMO.md) for the walkthrough and [DEPLOY.md](DEPLOY.md) for running it on Coolify.

## Run it locally

Requires Node 24, pnpm (Corepack picks the pinned version: `corepack enable`) and Docker.

```bash
docker compose up -d db      # Postgres 17 on localhost:5435
cp .env.example .env         # the defaults work for local development
pnpm install
pnpm db:migrate              # apply migrations
pnpm db:seed                 # fill the database with the demo data
pnpm dev                     # http://localhost:3000
```

Sign in as one of the demo people with the password `kai-rescue-demo`:

| Email | Who |
| --- | --- |
| `phillipa@satisfyfoodrescue.org.nz` | Coordinator (admin) |
| `margaret.fairweather@example.nz` | Regular warehouse volunteer, one refresher due soon |
| `tony.ratana@example.nz` | Driver help, Manual Handling overdue so route shifts are blocked |
| `jess.moorhouse@example.nz` | Approved two days ago, no training yet |

Or set `DEMO_MODE=1` in `.env` to get the one-click persona picker instead. Emails are printed to the dev server console (no `RESEND_API_KEY` needed), so sign-in links can be copied from there. The demo data is relative to today; `pnpm db:seed` regenerates it.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on port 3000 |
| `pnpm build` / `pnpm start` | Production build (`output: "standalone"`) and server |
| `pnpm lint` / `pnpm typecheck` | ESLint and TypeScript |
| `pnpm test` | Unit tests (Vitest, `tests/unit`), no database |
| `pnpm test:integration` | Jobs, outbox and sign-in links against Postgres (`satisfy_test`, created automatically) |
| `pnpm test:e2e` | Playwright against a production build with real sign-in (`satisfy_e2e`, recreated each run) |
| `pnpm db:migrate` | Create and apply a migration after editing `prisma/schema.prisma` |
| `pnpm db:deploy` | Apply pending migrations (what the container does on start) |
| `pnpm db:seed` | Replace the local database with the demo data. Refuses to run against production. |
| `pnpm db:reset` | Drop, migrate and seed |

CI (`.github/workflows/ci.yaml`) runs all four test levels and builds the Docker image on every pull request.

## How it works

**Stack.** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui on Base UI, Prisma 7 on Postgres (`@prisma/adapter-pg`), Zod, react-email and Resend. Conventions follow the Fair Food volunteer portal.

**Configuration** is validated at startup by `src/lib/env.ts`. Nothing is `NEXT_PUBLIC_`, so every setting is read at runtime and one Docker image serves every environment. See `.env.example`.

**Sign-in** (`src/lib/session.ts`, `src/lib/auth.ts`) offers a password, Google, or a passkey, as Fair Food does. There is no public sign-up: people get an account when a coordinator approves their application or adds them, and are emailed an invite to set a password. Anyone whose account was imported can use "First time here?" to get a link. Sessions are httpOnly cookies, and only their SHA-256 is stored; they slide for 30 days of inactivity, up to 180 days. Invite and reset links are single-use, hashed, never stored in the email log, and only used when the form is submitted, so mail scanners cannot burn them. Password attempts and link requests are rate limited. Deactivating a volunteer signs them out everywhere. `src/proxy.ts` sends signed-out visitors to sign-in with the page they wanted, and every page and action still checks with `requireVolunteer()` or `requireAdmin()`.

**Email** goes through one outbox (`src/lib/emails.ts`). Every message is written to the `Email` table first, which drives the Outbox page, each volunteer's communication history and the reminder de-duplication refs. It is then delivered through Resend after the response (`after()`), with an idempotency key. Failures are retried by the hourly job for two days. Templates are pure functions in `src/lib/email-templates.ts`, rendered by one react-email layout (`src/emails/message-email.tsx`). Web push is not built yet, so last-minute cover callouts go out as email.

**Scheduled work** runs from one idempotent endpoint, `POST /api/cron/tick`, called hourly by `scripts/cron-tick.mjs` (a Coolify scheduled task). It sends training reminders (30 days before expiry, on the day, weekly while overdue, with the coordinator told once at three weeks), shift reminders from 4pm the day before, last-minute cover notifications and uncovered-shift alerts. It also retries undelivered email and clears expired sessions and links. Every message carries a de-duplication ref, so a missed or repeated tick is harmless.

**Startup.** The container applies migrations, then `src/instrumentation.ts` runs `src/lib/bootstrap.ts`. On an empty production database that creates Satisfy's routes, shift types and training modules (`src/lib/reference-data.ts`), and while there is no active admin it makes `BOOTSTRAP_ADMIN_EMAIL` one. In demo mode it regenerates the demo data instead.

## Domain rules worth knowing

- A shift has a `capacity` (maximum) and a `needed` (minimum crew). Confirmed below needed is a gap. An absence releases the volunteer's assignments in that period; released assignments explain the gap ("Brian away, holiday").
- The training gate: to book a shift kind, a volunteer must hold the matching role and every module required for that role must be Complete or Due soon. Overdue or Not started blocks booking with a message naming the module. Regular slots already on the roster are not affected.
- Due soon is 30 days before expiry. Online modules can be completed in the app with a read-and-confirm step, which lifts the gate immediately.
- Bulk scheduling always previews first, skips shifts that already exist, and can roster regulars onto their weekday automatically.
- Last-minute cover: when a gap opens inside the shift type's last-minute window (48 hours by default, 72 for route shifts), eligible volunteers who opted in and are free that day are notified once per shift. If it is still uncovered inside the alert threshold (24 hours by default), the coordinator is emailed. Both thresholds are set per shift type in Admin > Shift types.
- New volunteers start with an Initial Visit, an in-person stage the coordinator usually books during the welcome call. In-person stages are marked complete with the date they happened, and expiry runs from that date.
- Role changes are made by an admin and email the volunteer coordinator, listing any training the new roles bring in. Volunteers can ask for a change from the Me tab.
- Every volunteer profile has a communication history: emails, absences, calls and notes the coordinator logs, and changes made on the volunteer's behalf.

## Layout

```
prisma/schema.prisma         data model; migrations in prisma/migrations
src/proxy.ts                 signed-out redirect for /app and /admin
src/instrumentation.ts       startup bootstrap
src/app/sign-in, forgot-password, reset-password, auth/google   sign-in
src/app/app/*                volunteer app (bottom tab bar, max width 30rem)
src/app/admin/*              coordinator admin (sidebar)
src/app/*/actions.ts         server actions, Zod-validated
src/app/api/cron/tick        hourly jobs; api/health (+ /ready) for probes
src/lib/env.ts               runtime configuration
src/lib/session.ts, auth.ts, oauth.ts, webauthn.ts   sign-in
src/lib/emails.ts, mailer.ts, email-templates.ts     outbox, delivery, wording
src/lib/jobs.ts, reminders.ts, cover.ts              scheduled work
src/lib/training.ts, roster.ts                       the booking gate and gaps
src/lib/bootstrap.ts, reference-data.ts, demo/       startup data and the demo
src/components/ui            shadcn primitives (owned source)
tests/unit, integration, e2e
```

## Theme

Colours and type follow the Satisfy Food Rescue Brand Guidelines: primary green `#00A551`, the secondary suite for charts and accents, and Montserrat for headings. Every colour, radius and font is a token in `src/app/globals.css`; fonts load in `src/app/layout.tsx`. Stag (the brand body face) needs a web licence, so Roboto Slab stands in. Emails repeat the tokens as hex in `src/emails/message-email.tsx`, because mail clients do not support CSS variables. Contrast is checked to WCAG AA, body text is at least 16px, tap targets are 44px, and status is always icon plus label.

## Not built yet

- **Web push** for last-minute cover (it is emailed for now).
- **Infoodle sync.** Waiting on API access. Until then new applications do not arrive automatically; coordinators add new volunteers from Volunteers > Add volunteer, and the Infoodle panels describe what will sync.
- **Bulk import** of the existing volunteer list. Coordinators can add volunteers one at a time, and anyone added can sign in through "First time here?".
- Creating new shift types and training modules from the admin (existing ones are editable). The module list is provisional until Satisfy confirms it.
