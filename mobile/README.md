# Satisfy Volunteers: native app

The volunteer app for iOS and Android, built with Expo SDK 57 and Expo Router. It covers everything a volunteer does on the web app (`/app`): Home, booking and cancelling shifts, covering gaps, training (online modules and in-person sessions), the regular slot and Mark me away, the harvest pool and the profile. Coordinator tools stay on the web.

It talks to the Next.js app at the repo root through `/api/mobile/*`. The contract both sides compile against is `packages/core/src/api.ts`; see "Native app API" in the root README.

## Run it

Requires Node 24 and pnpm (Corepack picks the pinned version). Start the web app first, then the app:

```bash
pnpm dev
```

```bash
cd mobile && pnpm install && pnpm start
```

Press `i` for the iOS simulator or `a` for an Android emulator, or scan the QR code with Expo Go on a phone on the same network. In development the app finds the API on the machine running Metro, port 3000, so a simulator, an emulator and a real phone all work without configuration (`src/lib/config.ts`). On an Android emulator that cannot reach your LAN address, run `adb reverse tcp:8081 tcp:8081 && adb reverse tcp:3000 tcp:3000` and open `exp://localhost:8081`.

Sign in by picking a volunteer persona. The coordinator persona is web-only.

Expo Go runs everything except push on Android, which Expo Go no longer supports; the Me tab says so. Push works in Expo Go on iOS and in development and release builds once the app is linked to an EAS project (below).

## Checks

```bash
pnpm lint
```

```bash
pnpm typegen && pnpm typecheck
```

```bash
pnpm test
```

```bash
pnpm check:deps
```

`typegen` writes Expo Router's route types so `tsc` checks every link; `pnpm start` also writes them. `check:deps` confirms every package matches the Expo SDK. CI runs all of these plus an `expo export` for both platforms (`.github/workflows/ci.yaml`, job "Native app").

## How it is put together

```
app.config.ts            name, bundle ids, icons, splash, plugins
eas.json                 build profiles: development, preview, production
assets/satisfy.icon      iOS 26 Liquid Glass icon (Icon Composer bundle)
scripts/                 icon generation, route type generation
src/app                  routes only (Expo Router)
  _layout.tsx            fonts, splash, auth gate, notification taps
  sign-in.tsx            demo persona picker
  (tabs)/_layout.tsx     native tab bar with badges
  (tabs)/(home,shifts,cover,training,me)/   one stack per tab, sharing shift/[id], module/[code], slot, harvest
  mark-away.tsx, role-request.tsx           form sheets
src/screens              screen bodies the routes render
src/components           UI primitives (ui/), shift cards and actions, brand graphics
src/lib                  API client, auth, queries, push, deep links
src/theme.ts             design tokens
```

- **Its own pnpm project.** `mobile/` has its own lockfile and `pnpm-workspace.yaml`. Expo SDK 57 pins React 19.2.3 while the web app runs a newer 19.2.x, and one shared `node_modules` would load two copies of React. Shared code comes from `packages/core` through a `link:` dependency, which Metro watches (`metro.config.js`).
- **Data.** TanStack Query over a small `fetch` client (`src/lib/api.ts`) with the session token from the Keychain or Keystore (`expo-secure-store`). Every screen handles loading, error, empty and content, keeps showing data when a refresh fails, and refreshes when it comes back into view. After any action the whole cache is refreshed, because a booking changes Home, Shifts, Cover and the tab badges at once; the button stays busy until the screen shows the result.
- **Rules stay on the server.** What a shift's button does (book, cover, cancel, blocked by training or a missing role, full, cancelled) arrives as `ShiftAction` from the API, so the app never re-implements the booking rules.
- **Native controls.** Native tabs (Liquid Glass on iOS 26, Material on Android), native stack headers, form sheets, the system date picker and SwiftUI and Compose switches through `@expo/ui`. Icons are SF Symbols on iOS and Material Symbols on Android, chosen by meaning in `src/components/ui/icon.tsx`.
- **Brand.** Colours, type and radii are the web theme's (`src/app/globals.css`), with a dark palette added. Montserrat throughout. The logo, food icons and waves are the web's vector paths drawn with `react-native-svg`. The app icon, Android adaptive icon and splash are rendered from the same paths: `node scripts/generate-icons.mjs` from the repo root.
- **Push.** After sign-in the app asks for notification permission and registers its Expo push token. Tapping a notification opens the screen its `url` points to; web paths such as `/app/shifts/abc` map to app screens in `src/lib/links.ts`.

## Releasing with EAS

Nothing deployment-specific is committed. Once per project:

1. `npx eas-cli@latest login`, then `npx eas-cli@latest init` to create the Expo project.
2. Set the project id and the API URL as EAS environment variables, for example `npx eas-cli@latest env:create --name EAS_PROJECT_ID --value <id> --environment production --visibility plaintext` and the same for `EXPO_PUBLIC_API_URL` (the deployed web app's URL). Repeat for `preview` and `development`. `app.config.ts` refuses to build a preview or production app without `EXPO_PUBLIC_API_URL`.
3. `npx eas-cli@latest credentials` sets up signing and the APNs key for push.

Then `npx eas-cli@latest build --profile preview` gives installable test builds, and `--profile production` plus `eas submit` goes to TestFlight and Google Play. The bundle id and package are `nz.org.satisfyfoodrescue.volunteers`; changing them after the first store upload is not possible.
