# Satisfy Volunteers

Volunteer management for Satisfy Food Rescue (Rangiora, North Canterbury), built by Awhina Tech. Three surfaces: a mobile-first volunteer web app (`/app`), a desktop coordinator admin (`/admin`), and the native volunteer app in `mobile/` (Expo), which talks to the same server. Volunteers book shifts and cover gaps, keep their training current and mark themselves away; coordinators run the roster, training, harvests, applications and communication.

The same code runs production and the sales demo. `DEMO_MODE=1` turns on the persona picker, regenerates demo data every day and sends no email. See [DEMO.md](DEMO.md) for the walkthrough and [DEPLOY.md](DEPLOY.md) for running it on Coolify.

## Run it locally

Requires Node 24, pnpm (Corepack picks the pinned version: `corepack enable`) and Docker.

```bash
docker compose up -d db      # Postgres 17 on localhost:5435
cp .env.example .env         # the defaults work for local development
pnpm install
pnpm db:deploy               # apply migrations
pnpm db:seed                 # fill the database with the demo data
pnpm dev                     # http://localhost:3000
```

Sign in as one of the demo people with the password `kai-rescue-demo` (`DEMO_PASSWORD` in `src/lib/personas.ts`; demo data only):

| Email | Who |
| --- | --- |
| `phillipa@satisfyfoodrescue.org.nz` | Coordinator (admin): gaps, overdue training, applications, the Outbox |
| `margaret.fairweather@example.nz` | Regular warehouse volunteer, Tuesday and Thursday, one refresher due soon |
| `tony.ratana@example.nz` | Driver help, Manual Handling overdue so route shifts are blocked |
| `jess.moorhouse@example.nz` | Approved two days ago, no training yet, needs an initial visit |

Or set `DEMO_MODE=1` in `.env` for the one-click persona picker. Without `RESEND_API_KEY`, emails are printed to the dev server console, so sign-in links can be copied from there. The demo data is relative to today; `pnpm db:seed` regenerates it.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on port 3000 |
| `pnpm build` / `pnpm start` | Production build (`output: "standalone"`) and the standalone server, as the Docker image runs it |
| `pnpm lint` / `pnpm typecheck` | ESLint and TypeScript |
| `pnpm test` | Unit tests (Vitest, `tests/unit`), no database |
| `pnpm test:integration` | Outbox, push, sign-in links, the app's sign-in handoff and jobs against Postgres (`satisfy_test`, created automatically) |
| `pnpm test:e2e` | Playwright against a production build with real sign-in (`satisfy_e2e`, recreated each run) |
| `pnpm test:smoke` | Every page as every persona and every native app endpoint, against a running demo server (see CI) |
| `pnpm db:migrate` | Create and apply a migration after editing `prisma/schema.prisma` |
| `pnpm db:deploy` | Apply pending migrations (what the container does on start) |
| `pnpm db:seed` | Replace the local database with the demo data. Refuses to run against production. |
| `pnpm db:reset` | Drop, migrate and seed |

## CI

`.github/workflows/ci.yaml` runs on every pull request and on pushes to `main`:

- **Lint, types and schema**: lint with no warnings, types, `prisma validate` and `format --check`, unit tests.
- **Integration tests** against a Postgres service, and a check that the migrations produce exactly the schema.
- **Build and smoke test**: builds once, runs Playwright with real sign-in, then boots a demo server and runs `pnpm test:smoke`, which renders every page as every persona (pages are found from `src/app`; a new dynamic segment needs a resolver in `scripts/smoke.ts`) and calls every native app endpoint (a new read endpoint needs a line in `mobileApiChecks`).
- **Docker image**: builds the production image and boots it against an empty Postgres the way a first deploy does: migrations, reference data, the bootstrap admin, then an hourly tick.
- **Native app**: in `mobile/`, lint, types (with Expo's typed routes), unit tests, `expo install --check` and an `expo export` for iOS and Android.

Dependabot opens weekly npm and monthly Actions and Docker base image updates.

## How it works

**Stack.** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui on Base UI, Prisma 7 on Postgres (`@prisma/adapter-pg`), Zod, react-email and Resend. Conventions follow the Fair Food volunteer portal.

**Configuration** is validated at startup by `src/lib/env.ts`. Nothing is `NEXT_PUBLIC_`, so every setting is read at runtime and one Docker image serves every environment. See `.env.example`.

**Sign-in** offers a password, Google, or a passkey, on the website and in the native app alike. The rules live once in `src/lib/sign-in.ts`; the website keeps an httpOnly cookie session (`src/lib/session.ts`) and the app a bearer token (`src/lib/mobile-auth.ts`), both stored only as their SHA-256 in `Session`. Anyone can sign up to volunteer, on the website (`/sign-up`) or in the app, but signing up sends an application, not an account: people get an account when a coordinator approves their application (Admin > Applications) or adds them, and are emailed an invite to set a password. The sign-up rules live once in `src/lib/applications.ts`; the reply never says whether an address already has an account (that person is emailed to sign in instead). Anyone whose account was imported can use "Set up your password" on the sign-in page to get a link. Web sessions slide for 30 days of inactivity, up to 180 days. Invite and reset links are single-use, hashed, never stored in the email log, and only used when the form is submitted, so mail scanners cannot burn them. Password attempts and link requests are rate limited. Deactivating a volunteer signs them out everywhere. Google sign-in is the authorization code flow with PKCE, with the ID token checked against Google's keys (`src/lib/oauth.ts`). `src/proxy.ts` sends signed-out visitors to sign-in with the page they wanted, and every page and action still checks with `requireVolunteer()` or `requireAdmin()`.

**Email and push** go through one outbox (`src/lib/emails.ts`). Every message is written to the `Email` table first, which drives the Outbox page, each volunteer's communication history and the reminder de-duplication refs. It is then delivered after the response (`after()`): emails through Resend with an idempotency key, push notifications through Expo to every phone the volunteer is signed in on. Someone with no phone signed in to the app gets a push as an email with the same words. Failures are retried by the hourly job for two days. Templates are pure functions in `src/lib/email-templates.ts`, rendered by one react-email layout (`src/emails/message-email.tsx`).

**Scheduled work** runs from one idempotent endpoint, `POST /api/cron/tick`, called hourly by `scripts/cron-tick.mjs` (a Coolify scheduled task). It sends training reminders (30 days before expiry, on the day, weekly while overdue, with the coordinator told once at three weeks), shift reminders from 4pm the day before, last-minute cover notifications and uncovered-shift alerts. It also retries undelivered messages and clears expired sessions, links and passkey challenges. Every message carries a de-duplication ref, so a missed or repeated tick is harmless.

**Startup.** The container applies migrations, then `src/instrumentation.ts` runs `src/lib/bootstrap.ts`. On an empty production database that creates Satisfy's routes, shift types and training modules (`src/lib/reference-data.ts`), and while there is no active admin it makes `BOOTSTRAP_ADMIN_EMAIL` one. In demo mode it regenerates the demo data instead (`src/lib/demo/seed.ts`).

**Vocabulary.** Enum values (roles, statuses, message kinds) are Postgres enums, written once more as string unions in `packages/core/src/domain.ts`, which the native app shares and which holds every display label. `src/lib/domain.ts` fails the build if the two drift apart.

## The theme file

Colours, logo and type follow the 2026 Satisfy Food Rescue brand refresh: primary Satisfy Green `#00A651` and Blue/Teal `#106379`, secondary Orange `#E08C3C` and Light Blue `#4395A2`, plus the printed tints (green 50% and 75%, blue/teal 90%, orange 50%). Montserrat, the logo font, is used throughout. Blue/teal is the working colour (buttons, links, selection, the admin sidebar and the volunteer app header), green marks the brand and anything that is all good, orange flags shifts that need cover, and light blue marks driver shifts and info. The logo, food icons and footer ribbons are inline SVG traced from the brand artwork (`src/components/brand/logo.tsx`). Every colour, radius and font is a token in one place: `src/app/globals.css`. The font is loaded in `src/app/layout.tsx`. Change the values in the `:root` block and the whole app, including chips, charts and email previews, follows. No component contains a raw hex value.

Contrast was checked numerically. White on blue/teal is 6.8:1, so it carries buttons and white text. Satisfy Green and Orange are too light for white labels, so green text uses a darker shade (5.6:1) and orange fills carry dark ink text (5.3:1). Each colour has a pale tint for backgrounds and a darkened text shade. Body text is 16px minimum, tap targets 44px, and status is always icon plus label, never colour alone.

## Native app API

The Expo app in `mobile/` talks to `/api/mobile/*`. Volunteer features only: coordinator tools stay on the web.

- **The contract** is `packages/core/src/api.ts`: every path, request body and response type, imported by both sides as `@satisfy/core/api`, so a mismatch fails `pnpm typecheck`. Reads return the payload type; mutations return `{ message }`. Failures are `{ error }`, written for the volunteer: 400 for a malformed request, 401 for a missing or expired token (the app signs out), 403 when sign-in is refused, 404 for an unknown id, 422 when the rule says no (shift full, training overdue), 500 for anything unexpected.
- **Auth**: `Authorization: Bearer <token>`. The app signs in the same ways as the website, with the same rules (`src/lib/sign-in.ts`): `POST /api/mobile/auth/password`; Google in the system browser (`/auth/google?app=<PKCE challenge>`, which hands back `satisfy://auth?code=...`, redeemed with the verifier at `POST /api/mobile/auth/google`, so a code caught by another app is useless); and passkeys (`/api/mobile/auth/passkey`), which share the website's relying party, so one passkey works in both. `GET /api/mobile/auth/config` says which methods to show. In the demo, `POST /api/mobile/auth/demo` signs in as a volunteer persona instead (the coordinator gets a 403 pointing to the web). Tokens are 32 random bytes; only their SHA-256 is stored, in the `Session` table as `client: APP`. A session lasts 180 days from last use. The daily demo reseed keeps persona sessions and push tokens, so a demo phone stays signed in. `src/lib/mobile-auth.ts`.
- **Passkeys in the app** need the site to vouch for it: `/.well-known/apple-app-site-association` (set `APPLE_TEAM_ID`) and `/.well-known/assetlinks.json` (set `ANDROID_CERT_FINGERPRINTS`). The iOS build adds `webcredentials:<host>` for an HTTPS `EXPO_PUBLIC_API_URL`.
- **Rules live once**: route handlers call the same functions as the web server actions (`src/lib/volunteer-actions.ts`), and what each shift's button does (`ShiftAction`), the home alert and the tab badges are worked out on the server with the same code the web uses.
- **Push**: the app registers its Expo push token (`POST /api/mobile/push-tokens`). A `PUSH` message for a volunteer with a registered phone is delivered through Expo's push service by the outbox (see Email and push below); tokens Expo reports as `DeviceNotRegistered` are removed. Set `EXPO_ACCESS_TOKEN` (optional) if the Expo project has enhanced push security turned on.
- **Adding an endpoint**: add the types and path to `api.ts`, put any new rule in `src/lib` (a mutation in `volunteer-actions.ts` with its Zod schema), then add `src/app/api/mobile/<path>/route.ts` wrapping the handler in `mobileHandler` and returning `json<YourType>(...)` or `mutation(result)`. Add the read to `scripts/smoke.ts`.

## Domain rules worth knowing

- A shift has a `capacity` (maximum) and a `needed` (minimum crew). Confirmed below needed is a gap. An absence releases the volunteer's regular assignments; released assignments are what the gap explains ("Brian away, holiday").
- The training gate: to book a shift kind, a volunteer must hold the matching role and every module required for that role must be Complete or Due soon. Overdue or Not started blocks booking with a message naming the module. Regular slots already on the roster are not affected.
- Due soon is 30 days before expiry. Online modules are completed in-app: the confirmation stays locked until the volunteer has scrolled to the end of the content and opened every video or link (`completionGate` in `packages/core/src/training.ts`, shared with the native app). It is a nudge, not proof, since nobody can see a video being watched. Confirming lifts the gate immediately. Coordinators edit the content and links, and add modules, from Admin > Training.
- Harvests are shifts of an ad hoc kind (`HARVEST`): created one at a time, never cover gaps, no last-minute pushes. The harvest pool is the `HARVEST` role, which volunteers join and leave themselves; harvest shifts stay locked until every module required for that role is current. The Initial Visit is not required, since the induction happens at the first harvest.
- One-off shifts (any kind) can be saved as drafts, which only coordinators see. Publishing can send a callout: an email and push to every active volunteer with the role.
- Announcements go to everyone, chosen roles, or one shift's crew, by email and optionally push, and land on each volunteer's communication history. Adding someone to a shift emails and pushes them too.
- Bulk scheduling always previews first, skips shifts that already exist, and can roster regulars onto their weekday automatically.
- Last-minute cover: when a cancellation or absence opens a gap inside the shift type's last-minute window (48 hours by default, 72 for route shifts), eligible volunteers who opted in to last-minute cover and are free that day get a push notification, once per shift. If it is still uncovered inside the shift type's alert threshold (24 hours by default), the coordinator gets an email to step in. Both thresholds are set per shift type in Admin > Shift types.
- New volunteers start with an Initial Visit, an in-person stage the coordinator usually books during the welcome call (Book initial visit on the volunteer's profile). In-person stages are marked complete with the date they happened, and expiry runs from that date.
- Coordinators (admins) are managed in Admin > Coordinators: add someone new, who is emailed an invite, or an existing volunteer by their email. Coordinators are not in the volunteer pool, so a volunteer made a coordinator comes off their regular slots and upcoming shifts (the page asks first) and keeps their roles, training and history. Removing access makes them a volunteer again. Nobody removes their own access, so there is always an active coordinator, and every change is on the person's communication history. The rules are in `src/lib/admin-access.ts`.
- Role changes are made by an admin from the volunteer's profile and email the volunteer coordinator, listing any training the new roles bring in. Volunteers can ask for a change from the Me tab.
- Every volunteer profile has a communication history: emails, push notifications, absences, calls and notes the coordinator logs, and changes made on the volunteer's behalf (`ContactLog`).

See `DEMO.md` for the ten-minute walkthrough.

## Layout

```
packages/core                shared with the native app: dates, domain labels, the API contract
prisma/schema.prisma         data model; migrations in prisma/migrations
src/proxy.ts                 signed-out redirect for /app and /admin
src/instrumentation.ts       startup bootstrap
src/app/sign-in, forgot-password, reset-password, auth/google   sign-in
src/app/sign-up              signing up to volunteer (an application)
src/app/.well-known          passkey association for the native app
src/app/app/*                volunteer app (bottom tab bar, max width 30rem)
src/app/admin/*              coordinator admin (sidebar)
src/app/api/mobile/*         native app API (route handlers)
src/app/api/cron/tick        hourly jobs; api/health (+ /ready) for probes
src/app/*/actions.ts         server actions, Zod-validated
src/lib/env.ts               runtime configuration
src/lib/sign-in.ts, session.ts, mobile-auth.ts, auth.ts, oauth.ts, webauthn.ts   sign-in
src/lib/emails.ts, mailer.ts, push.ts, email-templates.ts                         outbox, delivery, wording
src/lib/jobs.ts, reminders.ts, cover.ts                                           scheduled work
src/lib/training.ts, roster.ts                                                    the booking gate and gaps
src/lib/volunteer-actions.ts what a volunteer can change, shared by web and API
src/lib/bootstrap.ts, reference-data.ts, demo/   startup data and the demo
src/components/ui            shadcn primitives (owned source)
tests/unit, integration, e2e
mobile/                      Expo app, see mobile/README.md
```

## Not built yet

- **Bulk import** of the existing volunteer list. Coordinators can add volunteers one at a time, and anyone added can get a link from "Set up your password" on the sign-in page.
- **Password and Google settings in the native app.** The app adds and removes passkeys itself and links to Sign-in and security on the website for the rest.
