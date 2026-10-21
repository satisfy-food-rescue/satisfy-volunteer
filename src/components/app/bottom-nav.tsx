"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ME_TAB, PRIMARY_NAV, badgeLabel, isActive, type NavBadges } from "./nav";
import { cn } from "@/lib/utils";

const TABS = [...PRIMARY_NAV, ME_TAB];

export function BottomNav({ badges = {}, className }: { badges?: NavBadges; className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className={cn("fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur", className)}
    >
      <ul className="mx-auto grid w-full max-w-[36rem] grid-cols-5">
        {TABS.map((t) => {
          const active = isActive(t, pathname);
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
                {badge ? <span className="sr-only">, {badgeLabel(t, badge)}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
