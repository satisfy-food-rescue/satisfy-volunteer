"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { PRIMARY_NAV, YOU_NAV, badgeLabel, isActive, type NavBadges, type NavItem } from "./nav";
import { cn } from "@/lib/utils";

function NavLink({ item, pathname, badge }: { item: NavItem; pathname: string; badge?: number }) {
  const active = isActive(item, pathname);
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex min-h-11 items-center gap-3 rounded-xl px-3 font-display text-[0.9375rem] font-bold transition-colors",
          active ? "bg-teal text-white" : "text-ink-soft hover:bg-teal-tint-soft hover:text-ink",
        )}
      >
        <Icon className={cn("size-5 shrink-0", active ? "text-white" : "text-teal")} aria-hidden />
        <span className="min-w-0 flex-1 leading-tight">{item.label}</span>
        {badge ? (
          <>
            <span aria-hidden className="flex h-6 min-w-6 items-center justify-center rounded-full bg-orange px-1.5 text-xs font-bold text-ink tabular">
              {badge}
            </span>
            <span className="sr-only">, {badgeLabel(item, badge)}</span>
          </>
        ) : null}
      </Link>
    </li>
  );
}

/** Navigation on screens wide enough for it, in place of the tab bar. */
export function AppSidebar({
  person,
  since,
  badges = {},
  coordinatorEmail,
  className,
}: {
  person: { firstName: string; lastName?: string | null };
  /** "Volunteer since ..." under the name. */
  since: string;
  badges?: NavBadges;
  coordinatorEmail: string;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <aside className={cn("sticky top-0 h-dvh w-64 shrink-0 flex-col border-r border-border bg-card", className)}>
      <div className="px-6 pb-4 pt-6">
        <Link href="/app" className="-m-1 inline-block rounded-lg p-1" aria-label="Home">
          <Logo className="h-14" />
        </Link>
      </div>

      <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-1">
          {PRIMARY_NAV.map((item) => <NavLink key={item.href} item={item} pathname={pathname} badge={badges[item.href]} />)}
        </ul>
        <div>
          <h2 id="you-nav" className="px-3 pb-2 font-display text-sm font-bold text-muted-foreground">You</h2>
          <ul aria-labelledby="you-nav" className="flex flex-col gap-1">
            {YOU_NAV.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}
          </ul>
        </div>
      </nav>

      <div className="flex flex-col gap-3 border-t border-border p-3">
        <a
          href={`mailto:${coordinatorEmail}`}
          className="flex items-start gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-teal-tint-soft hover:text-ink"
        >
          <Mail className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
          <span>
            <span className="block font-semibold text-ink">Questions?</span>
            Email the coordinator
          </span>
        </a>
        <Link
          href="/app/profile"
          className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-teal-tint-soft"
        >
          <AvatarBadge person={person} size="md" />
          <span className="min-w-0">
            <span className="block font-bold leading-tight text-ink">
              {person.firstName} {person.lastName}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{since}</span>
          </span>
        </Link>
      </div>
    </aside>
  );
}
