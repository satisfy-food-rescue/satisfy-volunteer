import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { addDays, todayISO } from "@/lib/dates";
import { gapsBetween } from "@/lib/roster";
import { moduleStatuses, trainingSummary } from "@/lib/training";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const today = todayISO();
  const [applications, gaps, volunteers, modules] = await Promise.all([
    db.application.count({ where: { status: "PENDING" } }),
    gapsBetween(today, addDays(today, 14)),
    db.volunteer.findMany({ where: { status: "ACTIVE", role: "VOLUNTEER" }, include: { trainingRecords: true } }),
    db.trainingModule.findMany(),
  ]);
  const overdue = volunteers.filter((v) => trainingSummary(moduleStatuses(v, modules, v.trainingRecords, today)).overdue > 0).length;

  return (
    <SidebarProvider>
      <AdminSidebar user={user} badges={{ applications, gaps: gaps.length, training: overdue }} />
      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:hidden">
          <SidebarTrigger className="tap" />
          <span className="eyebrow">Coordinator</span>
        </header>
        <div className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-10">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
