// This codebase is the demo build: persona sign-in, daily reseed, Outbox-only
// email. The production build reads DEMO_MODE from the environment; anything
// gated on isDemo() (the persona endpoints of the native app API) disappears
// there.
export function isDemo(): boolean {
  return true;
}
