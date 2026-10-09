The Satisfy Volunteers native app: Expo SDK 57, Expo Router, React Native 0.86. Read README.md first.

## Expo changes every SDK: do not trust memory

Before using an Expo, EAS or React Native API, check the installed version's types in `node_modules` and the versioned docs (`https://docs.expo.dev/versions/v57.0.0/`). Install packages with `npx expo install <package>` so versions match the SDK, never plain `pnpm add`. Run `pnpm check:deps` after.

## Conventions

- `src/app` holds routes only. Screen bodies live in `src/screens`, shared UI in `src/components`, logic in `src/lib`.
- Tabs share their detail screens. A bare path such as `/shifts` opens inside the current tab, so switching tabs uses the group paths in `TAB` (`src/lib/links.ts`).
- Colours, type, spacing and radii come from `src/theme.ts` through `useTheme()`. No raw hex values or font names in components. Status is never colour alone: always an icon or a label.
- Every API call goes through `api()` and the hooks and `actions` in `src/lib/queries.ts`, typed by `@satisfy/core/api`. A contract change starts in `packages/core/src/api.ts` and must be made on the server too.
- Booking rules belong to the server. The app renders the `ShiftAction` it is given.
- `expo-notifications` is only imported in `src/lib/push.ts`, lazily: it throws on import in Expo Go on Android.
- Copy is plain New Zealand English and matches the web app word for word where the same thing is said. Never use the em dash; use a plain hyphen. Te reo greetings (Kia ora, Mōrena, Ka pai) are intentional.

## Before calling something done

Run `pnpm lint`, `pnpm typegen && pnpm typecheck` and `pnpm test`, then run the app (`pnpm start`) against the web app (`pnpm dev` at the repo root) and walk through the screen you changed on iOS and Android, in light and dark mode. A clean typecheck does not prove a screen renders.
