"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarOff,
  CalendarRange,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  Megaphone,
  Settings,
  ShieldCheck,
  Smartphone,
  Sprout,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Logo, LogoIcon } from "@/components/brand/logo";
import { signOut } from "@/app/sign-in/actions";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { fullName } from "@/lib/domain";

type NavLink = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  badge?: "applications" | "gaps" | "training";
};

// Grouped by the job in hand rather than by data type: what needs doing
// today, running the roster, looking after people, talking to them, and the
// set-up that rarely changes.
const SECTIONS: { label: string; links: NavLink[] }[] = [
  {
    label: "Overview",
    links: [
      { href: "/admin", label: "Today", icon: LayoutDashboard, exact: true },
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Roster",
    links: [
      { href: "/admin/roster", label: "Roster", icon: CalendarRange, badge: "gaps" },
      { href: "/admin/harvests", label: "Harvests", icon: Sprout },
      { href: "/admin/absences", label: "Absences", icon: CalendarOff },
    ],
  },
  {
    label: "People",
    links: [
      { href: "/admin/volunteers", label: "Volunteers", icon: Users },
      { href: "/admin/applications", label: "Applications", icon: Inbox, badge: "applications" },
      { href: "/admin/training", label: "Training", icon: GraduationCap, badge: "training" },
    ],
  },
  {
    label: "Messages",
    links: [
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { href: "/admin/outbox", label: "Outbox", icon: Mail },
    ],
  },
  {
    label: "Set-up",
    links: [
      { href: "/admin/shift-types", label: "Shift types", icon: ListChecks },
      { href: "/admin/coordinators", label: "Coordinators", icon: ShieldCheck },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

/** What each count badge counts, read out after the link name. */
const BADGE_NOUN: Record<NonNullable<NavLink["badge"]>, string> = {
  gaps: "shifts need cover",
  applications: "waiting for review",
  training: "volunteers overdue",
};

export function AdminSidebar({
  user,
  badges,
  demo,
}: {
  user: { firstName: string; lastName: string | null; email: string };
  badges: Record<NonNullable<NavLink["badge"]>, number>;
  demo: boolean;
}) {
  const pathname = usePathname();
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    contentRef.current?.querySelector("[data-active]")?.scrollIntoView({ block: "nearest" });
  }, [pathname]);
  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-3 pb-1 pt-4 group-data-[collapsible=icon]:px-2">
        <Link href="/admin" className="flex flex-col items-center gap-1.5 rounded-lg py-1" aria-label="Satisfy Food Rescue coordinator dashboard">
          <Logo tone="white" className="h-12 group-data-[collapsible=icon]:hidden" />
          <LogoIcon tone="white" className="hidden size-8 group-data-[collapsible=icon]:block" />
          <span className="rounded-full bg-white/12 px-2.5 py-0.5 font-display text-xs font-bold uppercase tracking-[0.18em] text-white group-data-[collapsible=icon]:hidden">Coordinator</span>
        </Link>
      </SidebarHeader>
      {/* Sized so every link fits a 768px-tall window; shorter ones scroll, the
          shadows show there is more and the current page is kept in view. */}
      <SidebarContent ref={contentRef} className="sidebar-scroll-shadows">
        {SECTIONS.map((section) => (
          <SidebarGroup key={section.label} className="py-0.5">
            <SidebarGroupLabel className="eyebrow h-6 text-teal-on">{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.links.map((link) => {
                  const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
                  const count = link.badge ? badges[link.badge] : 0;
                  return (
                    <SidebarMenuItem key={link.href}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={link.label}
                        className="h-[2.125rem] rounded-full px-3 text-[0.95rem] data-active:bg-white data-active:font-bold data-active:text-teal data-active:hover:bg-white data-active:hover:text-teal"
                        render={<Link href={link.href} />}
                      >
                        <link.icon className="size-4" />
                        <span>{link.label}</span>
                        {count > 0 && <span className="sr-only">, {count} {BADGE_NOUN[link.badge!]}</span>}
                      </SidebarMenuButton>
                      {count > 0 && (
                        <SidebarMenuBadge className="right-2 rounded-full bg-orange font-display font-bold text-ink tabular peer-data-[size=default]/menu-button:top-[0.4375rem] peer-hover/menu-button:text-ink peer-data-active/menu-button:text-ink">{count}</SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center">
          <Link
            href="/admin/security"
            title="Sign-in and security"
            aria-label={`${fullName(user)}, sign-in and security`}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 hover:bg-white/10 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:px-0"
          >
            <AvatarBadge person={user} size="sm" className="ring-2 ring-white/70" />
            <span className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
              <span className="block truncate text-sm font-bold text-white">{fullName(user)}</span>
              <span className="block truncate text-xs text-white/85">{user.email}</span>
            </span>
          </Link>
          <Link
            href="/app"
            className="tap flex items-center justify-center rounded-full text-white/85 hover:bg-white/10 hover:text-white"
            aria-label="Preview the volunteer app"
            title="Preview the volunteer app"
          >
            <Smartphone className="size-4" aria-hidden />
          </Link>
          <form action={signOut}>
            <button type="submit" className="tap flex items-center justify-center rounded-full text-white/85 hover:bg-white/10 hover:text-white" aria-label={demo ? "Switch persona" : "Sign out"} title={demo ? "Switch persona" : "Sign out"}>
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
