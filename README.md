# Satisfy Volunteers

Demo volunteer management app for Satisfy Food Rescue (Rangiora, North Canterbury), built by Awhina Tech as a sales prototype and a credible base for the full build. Two surfaces in one codebase: a mobile-first volunteer app and a desktop coordinator admin.

## Run it

Requires Node 20+ and pnpm (Corepack picks the pinned version).

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. The first `pnpm dev` creates a SQLite database and seeds it. Every seed date is relative to today, and the pre-dev script reseeds automatically when the date rolls over, so the demo never looks stale. To force a fresh seed:

```bash
pnpm db:reset
```

Other scripts: `pnpm lint`, `pnpm typecheck`, `pnpm build`.

## Persona switcher

There is no real authentication. The sign-in page lists four personas; picking one sets a cookie and everything downstream calls `requireVolunteer()` or `requireAdmin()` from `src/lib/session.ts`, which is the one file to replace with real sessions later.

| Persona | Who | What they show |
| --- | --- | --- |
| Phillipa | Coordinator (admin) | Dashboard gaps, overdue training, applications, Outbox, settings |
| Margaret Fairweather | Regular warehouse volunteer | Tue and Thu regular slot, one refresher due soon |
| Tony Ratana | Driver's assistant | Manual Handling overdue: route shifts blocked until the online refresher is done |
| Jess Moorhouse | New volunteer | Approved two days ago, no training, must book induction first |

"Switch persona" is on the volunteer Me tab and in the admin sidebar footer.

## The theme file

Colours and type follow the Satisfy Food Rescue Brand Guidelines: primary green `#00A551`, the secondary suite (yellow, orange, pink, dark blue, light blue, teal) for charts and accents, and Montserrat for headings. Every colour, radius and font is a token in one place: `src/app/globals.css`. Fonts are loaded in `src/app/layout.tsx`. The guidelines specify Stag for body text, which is a commercial face, so Roboto Slab stands in until a web licence is in place (swap to `next/font/local` with the licensed file). Change the values in the `:root` block and the whole app, including chips, charts and email previews, follows. No component contains a raw hex value.

Contrast was checked numerically: the brand green is used as a fill with deep green text, a darker green carries text on white, and the pink fill is deepened slightly so white labels pass WCAG AA. Lighter secondary colours get a pale tint for backgrounds and a darkened text shade. Body text is 16px minimum, tap targets 44px, and status is always icon plus label, never colour alone.

## What is mocked

- **Auth**: persona cookie, see above. Production uses email sign-in with passkeys, the same as the Fair Food portal.
- **Email**: nothing is sent. Every message the system would send is written to the `Email` table and shown in Admin > Outbox with a branded preview. Templates are pure functions in `src/lib/email-templates.ts`, shared by the seed and the server actions.
- **Reminders**: the rules are real code in `src/lib/reminders.ts` and can be run on demand from Admin > Training > Reminders. In production they run nightly.
- **Infoodle**: sync status, record ids and the application feed are sample data. The settings page describes what would sync in each direction once API access is confirmed.
- **Database**: SQLite via Prisma 7 for zero setup. The schema avoids SQLite-only features (enums are strings with TypeScript unions in `src/lib/domain.ts`) so production is a datasource swap to Postgres.

## Stack and layout

Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui on Base UI, Prisma 7, Zod, lucide-react, sonner. Conventions mirror the Fair Food volunteer portal so this can grow into the real build.

```
prisma/schema.prisma        data model (Postgres-compatible)
prisma/seed.ts              relative-to-today demo data
scripts/ensure-db.ts        first-run push and seed, daily reseed
src/app/sign-in             persona picker
src/app/app/*               volunteer app (bottom tab bar, max width 30rem)
src/app/admin/*             coordinator admin (sidebar)
src/app/*/actions.ts        server actions, Zod-validated
src/lib/training.ts         module status and the booking gate
src/lib/roster.ts           shift views, gap detection, available volunteers
src/lib/email-templates.ts  every email, as pure builders
src/components/ui           shadcn primitives (owned source)
```

## Domain rules worth knowing

- A shift has a `capacity` (maximum) and a `needed` (minimum crew). Confirmed below needed is a gap. An absence releases the volunteer's regular assignments; released assignments are what the gap explains ("Brian away, holiday").
- The training gate: to book a shift kind, a volunteer must hold the matching role and every module required for that role must be Complete or Due soon. Overdue or Not started blocks booking with a message naming the module. Regular slots already on the roster are not affected.
- Due soon is 30 days before expiry. Online modules can be completed in-app with a read-and-confirm step, which lifts the gate immediately.
- Bulk scheduling always previews first, skips shifts that already exist, and can roster regulars onto their weekday automatically.

See `DEMO.md` for the ten-minute walkthrough.
