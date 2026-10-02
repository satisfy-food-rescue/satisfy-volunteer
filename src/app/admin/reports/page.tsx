import { Clock, Repeat, ShieldCheck, UserX } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { addDays, dateToISO, durationHours, formatMonth, formatMonthShort, isoToDate, monthStart, todayISO } from "@/lib/dates";
import { moduleStatuses, trainingSummary } from "@/lib/training";
import { PageHeader } from "@/components/shared/page-header";
import { StatTile } from "@/components/admin/stat-tile";
import { BarChart } from "@/components/admin/bar-chart";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  await requireAdmin();
  const today = todayISO();
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = isoToDate(monthStart(today));
    d.setUTCMonth(d.getUTCMonth() - i);
    months.push(dateToISO(d));
  }
  const from = months[0];
  const [assignments, volunteers, modules] = await Promise.all([
    db.assignment.findMany({
      where: { status: { in: ["ATTENDED", "NO_SHOW"] }, shift: { date: { gte: isoToDate(from), lt: isoToDate(today) } } },
      include: { shift: { select: { date: true, startTime: true, endTime: true } } },
    }),
    db.volunteer.findMany({ where: { role: "VOLUNTEER" }, include: { trainingRecords: true } }),
    db.trainingModule.findMany(),
  ]);
  const monthKey = (d: Date) => dateToISO(d).slice(0, 7);
  const byMonth = months.map((m) => {
    const key = m.slice(0, 7);
    const rows = assignments.filter((a) => monthKey(a.shift.date) === key);
    const attended = rows.filter((a) => a.status === "ATTENDED");
    const hours = attended.reduce((n, a) => n + durationHours(a.shift.startTime, a.shift.endTime), 0);
    const active = new Set(attended.map((a) => a.volunteerId));
    return { m, key, hours, attended: attended.length, noShows: rows.length - attended.length, active, isCurrent: key === today.slice(0, 7) };
  });
  // Retention: of volunteers active in month N-1, share also active in month N.
  const retention = byMonth.map((cur, i) => {
    if (i === 0) return { m: cur.m, value: 0, na: true };
    const prev = byMonth[i - 1].active;
    if (prev.size === 0) return { m: cur.m, value: 0, na: true };
    let kept = 0;
    for (const id of prev) if (cur.active.has(id)) kept++;
    return { m: cur.m, value: Math.round((kept / prev.size) * 100), na: false };
  });
  const totalShifts = assignments.length;
  const totalNoShow = assignments.filter((a) => a.status === "NO_SHOW").length;
  const active = volunteers.filter((v) => v.status === "ACTIVE");
  const compliant = active.filter((v) => trainingSummary(moduleStatuses(v, modules, v.trainingRecords, today)).compliant).length;
  const last30 = assignments.filter((a) => dateToISO(a.shift.date) >= addDays(today, -30));
  const hours30 = last30.filter((a) => a.status === "ATTENDED").reduce((n, a) => n + durationHours(a.shift.startTime, a.shift.endTime), 0);
  const moduleCompliance = modules
    .map((m) => {
      const rel = active.map((v) => moduleStatuses(v, modules, v.trainingRecords, today).find((s) => s.module.id === m.id)!).filter((s) => s.required);
      const cur = rel.filter((s) => s.status === "COMPLETE" || s.status === "DUE_SOON").length;
      return { label: m.name.replace("Induction and Health & Safety", "Induction").replace("Food Safety and Hygiene", "Food Safety").replace("Slips, Trips and Falls", "Slips/Trips").replace("Route and Vehicle Safety", "Route Safety").replace("Driver Licence Check", "Licence"), sublabel: m.name, value: rel.length ? Math.round((cur / rel.length) * 100) : 100 };
    });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader eyebrow="Reports" title="How the volunteer programme is tracking" description={`Six months to ${formatMonth(today)}. Hours come from marked attendance, so they are only as good as the roster.`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Volunteer hours, last 30 days" value={Math.round(hours30)} hint={`${last30.filter((a) => a.status === "ATTENDED").length} attended shifts`} icon={Clock} tone="good" />
        <StatTile label="No-show rate" value={`${totalShifts ? ((totalNoShow / totalShifts) * 100).toFixed(1) : "0.0"}%`} hint={`${totalNoShow} of ${totalShifts} rostered shifts, 6 months`} icon={UserX} tone={totalNoShow / Math.max(totalShifts, 1) > 0.05 ? "warn" : "neutral"} />
        <StatTile label="Training compliance" value={`${active.length ? Math.round((compliant / active.length) * 100) : 100}%`} hint={`${compliant} of ${active.length} active volunteers fully current`} icon={ShieldCheck} tone={compliant / Math.max(active.length, 1) >= 0.9 ? "good" : "warn"} />
        <StatTile label="Month-on-month retention" value={`${retention.filter((r) => !r.na).slice(-1)[0]?.value ?? 0}%`} hint="Of last month's active volunteers, share active again this month" icon={Repeat} tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-xl text-ink">Volunteer hours per month</h2>
          <p className="mb-4 text-sm text-muted-foreground">Attended shift hours. The current month is partial.</p>
          <BarChart title="Volunteer hours per month" data={byMonth.map((b) => ({ label: formatMonthShort(b.m), sublabel: formatMonth(b.m), value: Math.round(b.hours), muted: b.isCurrent }))} unit=" h" />
        </section>
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-xl text-ink">Active volunteers per month</h2>
          <p className="mb-4 text-sm text-muted-foreground">Distinct people who attended at least one shift.</p>
          <BarChart title="Active volunteers per month" data={byMonth.map((b) => ({ label: formatMonthShort(b.m), sublabel: formatMonth(b.m), value: b.active.size, muted: b.isCurrent }))} />
        </section>
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-xl text-ink">No-shows per month</h2>
          <p className="mb-4 text-sm text-muted-foreground">Rostered volunteers marked as not attending. Sickness reported in advance is an absence, not a no-show.</p>
          <BarChart title="No-shows per month" tone="pink" data={byMonth.map((b) => ({ label: formatMonthShort(b.m), sublabel: formatMonth(b.m), value: b.noShows, muted: b.isCurrent }))} />
        </section>
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-xl text-ink">Training compliance by module</h2>
          <p className="mb-4 text-sm text-muted-foreground">Share of volunteers who need the module and are current on it.</p>
          <BarChart title="Training compliance by module" data={moduleCompliance} unit="%" max={100} />
        </section>
      </div>
    </div>
  );
}
