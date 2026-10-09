// The demo personas, in sign-in order. Shared by the web persona picker and the
// native app's demo sign-in. Each key matches Volunteer.personaKey in the seed.
export type PersonaKey = "phillipa" | "margaret" | "tony" | "jess";

export type Persona = {
  key: PersonaKey;
  label: string;
  blurb: string;
  surface: "Admin (desktop)" | "Volunteer app";
};

export const PERSONAS: readonly Persona[] = [
  {
    key: "phillipa",
    label: "Coordinator",
    blurb: "Admin view: roster, gaps, training compliance, applications and the Outbox.",
    surface: "Admin (desktop)",
  },
  {
    key: "margaret",
    label: "Regular warehouse volunteer",
    blurb: "Tuesdays and Thursdays on the sorting floor. Training current, one refresher due soon.",
    surface: "Volunteer app",
  },
  {
    key: "tony",
    label: "Driver help, refresher overdue",
    blurb: "Wednesday Rangiora / Kaiapoi route. Manual Handling lapsed, so route shifts are blocked until it is done.",
    surface: "Volunteer app",
  },
  {
    key: "jess",
    label: "New volunteer, no training yet",
    blurb: "Approved from the Infoodle form two days ago. Needs an initial visit before booking anything.",
    surface: "Volunteer app",
  },
];
