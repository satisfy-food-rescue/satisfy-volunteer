"use client";

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
  Settings,
  Smartphone,
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

const SECTIONS: { label: string; links: NavLink[] }[] = [
  {
    label: "Roster",
    links: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/admin/roster", label: "Roster", icon: CalendarRange, badge: "gaps" },
      { href: "/admin/absences", label: "Absences", icon: CalendarOff },
      { href: "/admin/shift-types", label: "Shift types", icon: ListChecks },
    ],
  },
  {
    label: "People",
    links: [
      { href: "/admin/volunteers", label: "Volunteers", icon: Users },
      { href: "/admin/training", label: "Training", icon: GraduationCap, badge: "training" },
      { href: "/admin/applications", label: "Applications", icon: Inbox, badge: "applications" },
    ],
  },
  {
    label: "System",
    links: [
      { href: "/admin/outbox", label: "Outbox", icon: Mail },
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AdminSidebar({
  user,
  badges,
}: {
  user: { firstName: string; lastName: string | null; email: string };
  badges: Record<NonNullable<NavLink["badge"]>, number>;
}) {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-3 pb-2 pt-5 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:pt-4">
        <Link href="/admin" className="flex flex-col items-center gap-2 rounded-lg py-1" aria-label="Satisfy Food Rescue coordinator dashboard">
          <Logo tone="white" className="h-20 group-data-[collapsible=icon]:hidden" />
          <LogoIcon tone="white" className="hidden size-8 group-data-[collapsible=icon]:block" />
          <span className="rounded-full bg-white/12 px-2.5 py-0.5 font-display text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white group-data-[collapsible=icon]:hidden">Coordinator</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {SECTIONS.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="eyebrow text-white/60">{section.label}</SidebarGroupLabel>
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
                        className="h-10 rounded-full px-3 text-[0.95rem] data-active:bg-white data-active:font-bold data-active:text-teal data-active:hover:bg-white data-active:hover:text-teal"
                        render={<Link href={link.href} />}
                      >
                        <link.icon className="size-4" />
                        <span>{link.label}</span>
                      </SidebarMenuButton>
                      {count > 0 && (
                        <SidebarMenuBadge className="right-2 rounded-full bg-orange font-display font-bold text-ink tabular peer-data-[size=default]/menu-button:top-2.5 peer-hover/menu-button:text-ink peer-data-active/menu-button:text-ink">{count}</SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        <SidebarGroup>
          <SidebarGroupLabel className="eyebrow text-white/60">Preview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Volunteer app" className="h-10 rounded-full px-3 text-[0.95rem]" render={<Link href="/app" />}>
                  <Smartphone className="size-4" />
                  <span>Volunteer app</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
          <AvatarBadge person={user} size="sm" className="ring-2 ring-white/70" />
          <div className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-bold text-white">{fullName(user)}</p>
            <p className="truncate text-xs text-white/70">{user.email}</p>
          </div>
          <form action={signOut} className="group-data-[collapsible=icon]:hidden">
            <button type="submit" className="tap flex items-center justify-center rounded-full text-white/75 hover:bg-white/10 hover:text-white" aria-label="Switch persona">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
