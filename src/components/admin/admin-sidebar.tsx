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
import { LogoMark } from "@/components/brand/logo";
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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <Link href="/admin" className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
          <LogoMark size={36} />
          <span className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-display text-[0.95rem] tracking-[0.08em] text-ink">SATISFY</span>
            <span className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-green-text">Coordinator</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {SECTIONS.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="eyebrow">{section.label}</SidebarGroupLabel>
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
                        className="h-10 text-[0.95rem] data-[active=true]:bg-green-tint data-[active=true]:font-bold data-[active=true]:text-green-deep"
                        render={<Link href={link.href} />}
                      >
                        <link.icon className="size-4" />
                        <span>{link.label}</span>
                      </SidebarMenuButton>
                      {count > 0 && (
                        <SidebarMenuBadge className="bg-magenta-tint text-magenta tabular">{count}</SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        <SidebarGroup>
          <SidebarGroupLabel className="eyebrow">Preview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Volunteer app" className="h-10 text-[0.95rem]" render={<Link href="/app" />}>
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
          <AvatarBadge person={user} size="sm" />
          <div className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-bold text-ink">{fullName(user)}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <form action={signOut} className="group-data-[collapsible=icon]:hidden">
            <button type="submit" className="tap flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-ink" aria-label="Switch persona">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
