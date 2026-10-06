// The four demo personas. The demo seed creates people with these emails and
// the demo sign-in page signs straight in as them (DEMO_MODE only). Outside
// the demo they sign in with DEMO_PASSWORD, which local development and the
// end-to-end tests use. Demo data only: never a real account.
export const DEMO_PASSWORD = "kai-rescue-demo";

export const PERSONAS = [
  { key: "phillipa", email: "phillipa@satisfyfoodrescue.org.nz" },
  { key: "margaret", email: "margaret.fairweather@example.nz" },
  { key: "tony", email: "tony.ratana@example.nz" },
  { key: "jess", email: "jess.moorhouse@example.nz" },
] as const;

export type PersonaKey = (typeof PERSONAS)[number]["key"];

export function personaEmail(key: string): string | null {
  return PERSONAS.find((p) => p.key === key)?.email ?? null;
}
