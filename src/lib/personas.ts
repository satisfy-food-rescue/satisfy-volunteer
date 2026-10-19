// The demo personas, in sign-in order. Shared by the web persona picker and
// the native app's demo sign-in (both DEMO_MODE only). The demo seed creates
// a volunteer with each email. Outside the demo, the same seeded people sign
// in with DEMO_PASSWORD, which local development and the end-to-end tests
// use. Demo data only: never a real account.
export const DEMO_PASSWORD = "kai-rescue-demo";

export type PersonaKey = "phillipa" | "margaret" | "tony" | "jess";

export type Persona = {
  key: PersonaKey;
  email: string;
  label: string;
  blurb: string;
  surface: "Admin (desktop)" | "Volunteer app";
};

export const PERSONAS: readonly Persona[] = [
  {
    key: "phillipa",
    email: "phillipa@satisfyfoodrescue.org.nz",
    label: "Coordinator",
    blurb: "Admin view: roster, gaps, training compliance, applications and the Outbox.",
    surface: "Admin (desktop)",
  },
  {
    key: "margaret",
    email: "margaret.fairweather@example.nz",
    label: "Regular warehouse volunteer",
    blurb: "Tuesdays and Thursdays on the sorting floor. Training current, one refresher due soon.",
    surface: "Volunteer app",
  },
  {
    key: "tony",
    email: "tony.ratana@example.nz",
    label: "Driver help, refresher overdue",
    blurb: "Wednesday Rangiora / Kaiapoi route. Manual Handling lapsed, so route shifts are blocked until it is done.",
    surface: "Volunteer app",
  },
  {
    key: "jess",
    email: "jess.moorhouse@example.nz",
    label: "New volunteer, no training yet",
    blurb: "Signed up on the website and was approved two days ago. Needs an initial visit before booking anything.",
    surface: "Volunteer app",
  },
];

export function personaEmail(key: string): string | null {
  return PERSONAS.find((p) => p.key === key)?.email ?? null;
}
