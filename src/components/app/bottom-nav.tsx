"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, GraduationCap, HandHelping, Home, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/app", label: "Home", icon: Home, exact: true },
  { href: "/app/shifts", label: "Shifts", icon: CalendarDays },
  { href: "/app/gaps", label: "Cover", icon: HandHelping },
  { href: "/app/training", label: "Training", icon: GraduationCap },
  { href: "/app/profile", label: "Me", icon: UserRound },
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
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          const Icon = t.icon;
          const badge = badges[t.href];
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 font-display text-[0.7rem] font-bold transition-colors",
                  active ? "text-green-text" : "text-muted-foreground hover:text-ink",
                )}
              >
                <span className={cn("relative flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-green-tint")}>
                  <Icon className="size-5" aria-hidden />
                  {badge ? (
                    <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-pink px-1 text-[0.6rem] font-bold text-white">
                      {badge}
                    </span>
                  ) : null}
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
