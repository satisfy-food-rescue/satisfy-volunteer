"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, GraduationCap, HandHelping, Home, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
  /** Other sections that belong to this tab. */
  also?: string[];
  /** What the count badge counts, for screen readers. */
  badgeNoun?: string;
};

const TABS: Tab[] = [
  { href: "/app", label: "Home", icon: Home, exact: true },
  { href: "/app/shifts", label: "Shifts", icon: CalendarDays },
  { href: "/app/gaps", label: "Cover", icon: HandHelping, badgeNoun: "shifts need cover" },
  { href: "/app/training", label: "Training", icon: GraduationCap, badgeNoun: "modules need doing" },
  // Reached from the Me tab, so it stays lit there.
  { href: "/app/profile", label: "Me", icon: UserRound, also: ["/app/slot", "/app/harvest", "/app/security"] },
];

export function BottomNav({ badges = {} }: { badges?: Partial<Record<string, number>> }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid w-full max-w-[30rem] grid-cols-5">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : [t.href, ...(t.also ?? [])].some((p) => pathname.startsWith(p));
          const Icon = t.icon;
          const badge = badges[t.href];
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-16 flex-col items-center justify-center gap-1 font-display text-xs font-bold transition-colors",
                  active ? "text-teal" : "text-muted-foreground hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "relative flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    active && "bg-teal text-white",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {badge ? (
                    <span aria-hidden className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange px-1 text-xs font-bold text-ink ring-2 ring-card tabular">
                      {badge}
                    </span>
                  ) : null}
                </span>
                {t.label}
                {badge ? <span className="sr-only">, {badge} {t.badgeNoun}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
