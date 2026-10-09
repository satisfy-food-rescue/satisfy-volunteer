# Satisfy Volunteers

Demo volunteer management app for Satisfy Food Rescue (Rangiora, North Canterbury), built by Awhina Tech as a sales prototype and a credible base for the full build. Two surfaces in one codebase: a mobile-first volunteer app and a desktop coordinator admin.

## Run it

Requires Node 24 and pnpm (Corepack picks the pinned version).

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. The first `pnpm dev` creates a SQLite database and seeds it. Every seed date is relative to today, and the pre-dev script reseeds automatically when the date rolls over, so the demo never looks stale. To force a fresh seed:

```bash
pnpm db:reset
```

Other scripts: `pnpm lint`, `pnpm typecheck`, `pnpm test` (unit tests, Vitest), `pnpm build`.

## CI

`.github/workflows/ci.yaml` runs on every pull request and on pushes to `main`:

- **Lint, types and schema**: `pnpm lint --max-warnings 0`, `pnpm typecheck`, `prisma validate`, `prisma format --check` and the unit tests (`pnpm test`, `tests/unit`).
- **Build and smoke test**: builds, boots `pnpm start:prod` on a fresh database (the same create-and-seed path a deploy takes), then `pnpm test:smoke` renders every page as every persona and fails on anything but a 200. Pages are found from `src/app`, so new pages are covered automatically; a new dynamic segment needs a resolver in `scripts/smoke.ts`. It then signs in to the native app API as every volunteer persona, reads every endpoint, saves the profile unchanged and signs out; a new read endpoint needs a line in `mobileApiChecks`.
- **Docker image**: builds the production image and boots it on an empty volume.
- **Native app**: in `mobile/`, lint, types (with Expo's typed routes generated first, so every link is checked against a real screen), unit tests, `expo install --check` (every package matches the Expo SDK) and an `expo export` that bundles the app for iOS and Android.

To run the smoke test locally, start a production server and point it there:

```bash
pnpm build && PORT=3100 pnpm start:prod
BASE_URL=http://localhost:3100 pnpm test:smoke
```

Dependabot opens weekly npm and monthly Actions and Docker base image updates.

## Persona switcher

There is no real authentication. The sign-in page lists four personas; picking one sets a cookie and everything downstream calls `requireVolunteer()` or `requireAdmin()` from `src/lib/session.ts`, which is the one file to replace with real sessions later.

| Persona | Who | What they show |
| --- | --- | --- |
| Phillipa | Coordinator (admin) | Dashboard gaps, overdue training, applications, volunteer profiles with contact history, shift types, Outbox |
| Margaret Fairweather | Regular warehouse volunteer | Tue and Thu regular slot, one refresher due soon |
| Tony Ratana | Driver help | Manual Handling overdue: route shifts blocked until the online refresher is done |
| Jess Moorhouse | New volunteer | Approved two days ago, no training, needs an initial visit first |

"Switch persona" is on the volunteer Me tab and in the admin sidebar footer.

## The theme file

Colours, logo and type follow the 2026 Satisfy Food Rescue brand refresh: primary Satisfy Green `#00A651` and Blue/Teal `#106379`, secondary Orange `#E08C3C` and Light Blue `#4395A2`, plus the printed tints (green 50% and 75%, blue/teal 90%, orange 50%). Montserrat, the logo font, is used throughout. Blue/teal is the working colour (buttons, links, selection, the admin sidebar and the volunteer app header), green marks the brand and anything that is all good, orange flags shifts that need cover, and light blue marks driver shifts and info. The logo, food icons and footer ribbons are inline SVG traced from the brand artwork (`src/components/brand/logo.tsx`). Every colour, radius and font is a token in one place: `src/app/globals.css`. The font is loaded in `src/app/layout.tsx`. Change the values in the `:root` block and the whole app, including chips, charts and email previews, follows. No component contains a raw hex value.

Contrast was checked numerically. White on blue/teal is 6.8:1, so it carries buttons and white text. Satisfy Green and Orange are too light for white labels, so green text uses a darker shade (5.6:1) and orange fills carry dark ink text (5.3:1). Each colour has a pale tint for backgrounds and a darkened text shade. Body text is 16px minimum, tap targets 44px, and status is always icon plus label, never colour alone.

## What is mocked

- **Auth**: persona cookie, see above. Production uses email sign-in with passkeys, the same as the Fair Food portal.
- **Email and push**: no email is sent. Every email and push notification the system would send is written to the `Email` table (`channel` is `EMAIL` or `PUSH`) and shown in Admin > Outbox with a branded preview. Templates are pure functions in `src/lib/email-templates.ts`, shared by the seed and the server actions. Pushes are also delivered for real to any phone signed in to the native app (see below).
- **Reminders and cover checks**: the rules are real code in `src/lib/reminders.ts` and `src/lib/cover.ts` and can be run on demand from Admin > Training > Reminders. In production training reminders run nightly and cover checks hourly.
- **Infoodle**: sync status, record ids and the application feed are sample data. The settings page describes what would sync in each direction once API access is confirmed.
- **Database**: SQLite via Prisma 7 for zero setup. The schema avoids SQLite-only features (enums are strings with TypeScript unions in `src/lib/domain.ts`) so production is a datasource swap to Postgres.

## Stack and layout

Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui on Base UI, Prisma 7, Zod, lucide-react, sonner. Conventions mirror the Fair Food volunteer portal so this can grow into the real build.

```
packages/core               shared with the native app: dates, domain labels, the API contract
prisma/schema.prisma        data model (Postgres-compatible)
prisma/seed.ts              relative-to-today demo data
scripts/ensure-db.ts        first-run push and seed, daily reseed
scripts/smoke.ts            every page and API endpoint as every persona
src/app/sign-in             persona picker
src/app/app/*               volunteer app (bottom tab bar, max width 30rem)
src/app/admin/*             coordinator admin (sidebar)
src/app/api/mobile/*        native app API (route handlers)
src/app/*/actions.ts        server actions, Zod-validated
src/lib/volunteer-actions.ts  what a volunteer can change, shared by web and API
src/lib/mobile-api/*        builds the API's contract types from roster and training views
src/lib/training.ts         module status and the booking gate
src/lib/roster.ts           shift views, gap detection, available volunteers
src/lib/cover.ts            last-minute push notifications and coordinator alerts
src/lib/email-templates.ts  every email, as pure builders
src/components/ui           shadcn primitives (owned source)
tests/unit                  Vitest unit tests for pure logic
mobile/                     Expo app, see mobile/README.md
```

## Native app API

The Expo app in `mobile/` talks to `/api/mobile/*`. Volunteer features only: coordinator tools stay on the web.

- **The contract** is `packages/core/src/api.ts`: every path, request body and response type, imported by both sides as `@satisfy/core/api`, so a mismatch fails `pnpm typecheck`. Reads return the payload type; mutations return `{ message }`. Failures are `{ error }`, written for the volunteer: 400 for a malformed request, 401 for a missing or expired token (the app signs out), 403 when sign-in is refused, 404 for an unknown id, 422 when the rule says no (shift full, training overdue), 500 for anything unexpected.
- **Auth**: `Authorization: Bearer <token>`. In the demo, `POST /api/mobile/auth/demo` signs in as a volunteer persona (the coordinator gets a 403 pointing to the web). Tokens are 32 random bytes; only their SHA-256 is stored, in the `Session` table, which has the same shape as the production build's. A session lasts 180 days from last use. The daily reseed keeps persona sessions and push tokens, so a demo phone stays signed in. `src/lib/mobile-auth.ts`.
- **Rules live once**: route handlers call the same functions as the web server actions (`src/lib/volunteer-actions.ts`), and what each shift's button does (`ShiftAction`), the home alert and the tab badges are worked out on the server with the same code the web uses.
- **Push**: the app registers its Expo push token (`POST /api/mobile/push-tokens`). Whenever a `PUSH` row is written to the Outbox for a volunteer with a registered device, it is also sent through Expo's push service after the response (`src/lib/push.ts`); tokens Expo reports as `DeviceNotRegistered` are removed. Set `EXPO_ACCESS_TOKEN` (optional) if the Expo project has enhanced push security turned on.
- **Adding an endpoint**: add the types and path to `api.ts`, put any new rule in `src/lib` (a mutation in `volunteer-actions.ts` with its Zod schema), then add `src/app/api/mobile/<path>/route.ts` wrapping the handler in `mobileHandler` and returning `json<YourType>(...)` or `mutation(result)`. Add the read to `scripts/smoke.ts`.

## Domain rules worth knowing

- A shift has a `capacity` (maximum) and a `needed` (minimum crew). Confirmed below needed is a gap. An absence releases the volunteer's regular assignments; released assignments are what the gap explains ("Brian away, holiday").
- The training gate: to book a shift kind, a volunteer must hold the matching role and every module required for that role must be Complete or Due soon. Overdue or Not started blocks booking with a message naming the module. Regular slots already on the roster are not affected.
- Due soon is 30 days before expiry. Online modules can be completed in-app with a read-and-confirm step, which lifts the gate immediately.
- Bulk scheduling always previews first, skips shifts that already exist, and can roster regulars onto their weekday automatically.
- Last-minute cover: when a cancellation or absence opens a gap inside the shift type's last-minute window (48 hours by default, 72 for route shifts), eligible volunteers who opted in to last-minute cover and are free that day get a push notification, once per shift. If it is still uncovered inside the shift type's alert threshold (24 hours by default), the coordinator gets an email to step in. Both thresholds are set per shift type in Admin > Shift types.
- New volunteers start with an Initial Visit, an in-person stage the coordinator usually books during the welcome call (Book initial visit on the volunteer's profile). In-person stages are marked complete with the date they happened, and expiry runs from that date.
- Role changes are made by an admin from the volunteer's profile and email the volunteer coordinator, listing any training the new roles bring in. Volunteers can ask for a change from the Me tab.
- Every volunteer profile has a communication history: emails, push notifications, absences, calls and notes the coordinator logs, and changes made on the volunteer's behalf (`ContactLog`).

See `DEMO.md` for the ten-minute walkthrough.
