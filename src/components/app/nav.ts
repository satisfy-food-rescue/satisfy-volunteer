import { CalendarCheck, CalendarDays, GraduationCap, HandHelping, Home, KeyRound, Sprout, UserRound, type LucideIcon } from "lucide-react";

// Where a volunteer can go, written once for the phone's tab bar and the
// sidebar on wider screens. On a phone the pages about the volunteer sit
// behind the Me tab; with a sidebar there is room to list them.

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Other sections that light this item up. */
  also?: string[];
  /** What the count badge counts, for screen readers: one, then many. */
  badgeNoun?: [string, string];
};

export const PRIMARY_NAV: NavItem[] = [
  { href: "/app", label: "Home", icon: Home, exact: true },
  { href: "/app/shifts", label: "Shifts", icon: CalendarDays },
  { href: "/app/gaps", label: "Cover", icon: HandHelping, badgeNoun: ["shift you can cover", "shifts you can cover"] },
  { href: "/app/training", label: "Training", icon: GraduationCap, badgeNoun: ["module needs doing", "modules need doing"] },
];

/** The phone's fifth tab, which leads to the pages in YOU_NAV. */
export const ME_TAB: NavItem = { href: "/app/profile", label: "Me", icon: UserRound, also: ["/app/slot", "/app/harvest", "/app/security"] };

export const YOU_NAV: NavItem[] = [
  { href: "/app/slot", label: "Regular slot and away", icon: CalendarCheck },
  { href: "/app/harvest", label: "Harvest", icon: Sprout },
  { href: "/app/profile", label: "My profile", icon: UserRound },
  { href: "/app/security", label: "Sign-in and security", icon: KeyRound },
];

export function isActive(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : [item.href, ...(item.also ?? [])].some((p) => pathname.startsWith(p));
}

/** "2 shifts you can cover", for the screen reader text beside a badge. */
export function badgeLabel(item: NavItem, count: number) {
  return `${count} ${item.badgeNoun?.[count === 1 ? 0 : 1] ?? ""}`.trim();
}

/** Badge counts keyed by href. */
export type NavBadges = Partial<Record<string, number>>;
