import { Clock, FileSpreadsheet, GraduationCap, Repeat, ShieldCheck, Sprout, Users, UserX } from "lucide-react";
import { harvestOnly, inHarvestPool, inTraining } from "@/lib/domain";
import { ReportDownload } from "@/components/admin/report-download";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { IN_POOL } from "@/lib/pool";
import { addDays, dateToISO, durationHours, formatMonth, formatMonthShort, isoToDate, monthStart, todayISO } from "@/lib/dates";
import { moduleStatuses, trainingSummary } from "@/lib/training";
import { PageHeader } from "@/components/shared/page-header";
import { StatTile } from "@/components/admin/stat-tile";
import { BarChart, HorizontalBarChart } from "@/components/admin/bar-chart";

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
    db.volunteer.findMany({ where: IN_POOL, include: { trainingRecords: true } }),
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
  const trainees = active.filter(inTraining).length;
  const harvest = active.filter(inHarvestPool).length;
  const onlyHarvest = active.filter(harvestOnly).length;
  const compliant = active.filter((v) => trainingSummary(moduleStatuses(v, modules, v.trainingRecords, today)).compliant).length;
  const last30 = assignments.filter((a) => dateToISO(a.shift.date) >= addDays(today, -30));
  const hours30 = last30.filter((a) => a.status === "ATTENDED").reduce((n, a) => n + durationHours(a.shift.startTime, a.shift.endTime), 0);
  const moduleCompliance = modules
    .map((m) => {
      const rel = active.map((v) => moduleStatuses(v, modules, v.trainingRecords, today).find((s) => s.module.id === m.id)!).filter((s) => s.required);
      const cur = rel.filter((s) => s.status === "COMPLETE" || s.status === "DUE_SOON").length;
      return { label: m.name, value: rel.length ? Math.round((cur / rel.length) * 100) : 100 };
    });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader eyebrow="Overview" title="Reports" description={`How the volunteer programme is tracking over the six months to ${formatMonth(today)}. Hours come from marked attendance, so they are only as good as the roster.`} />
      <section className="flex flex-col gap-4" aria-labelledby="now-h">
        <h2 id="now-h" className="text-2xl text-ink">Volunteers now</h2>
        <div className="grid grid-cols-1 gap-4 @xl/admin:grid-cols-3">
          <StatTile label="Active volunteers" value={active.length} hint={`${volunteers.length - active.length} inactive`} icon={Users} href="/admin/volunteers" />
          <StatTile label="In training" value={trainees} hint="Induction and training stages, before a role" icon={GraduationCap} href="/admin/volunteers?role=TRAINING" />
          <StatTile label="Harvest pool" value={harvest} hint={`${onlyHarvest} harvest only`} icon={Sprout} href="/admin/volunteers?role=HARVEST" />
        </div>
      </section>
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5" aria-labelledby="download-h">
        <div>
          <h2 id="download-h" className="flex items-center gap-2 text-xl text-ink"><FileSpreadsheet className="size-5 text-teal" aria-hidden /> Volunteer report</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">One row per volunteer: when they joined and started each role, their Ministry of Justice check, agreements and training dates. Opens in Excel or Google Sheets.</p>
        </div>
        <ReportDownload today={today} />
      </section>
      <h2 className="-mb-4 text-2xl text-ink">The last six months</h2>
      <div className="grid grid-cols-1 gap-4 @xl/admin:grid-cols-2 @5xl/admin:grid-cols-4">
        <StatTile label="Volunteer hours, last 30 days" value={Math.round(hours30)} hint={`${last30.filter((a) => a.status === "ATTENDED").length} attended shifts`} icon={Clock} />
        <StatTile label="No-show rate" value={`${totalShifts ? ((totalNoShow / totalShifts) * 100).toFixed(1) : "0.0"}%`} hint={`${totalNoShow} of ${totalShifts} rostered shifts, 6 months`} icon={UserX} />
        <StatTile label="Training compliance" value={`${active.length ? Math.round((compliant / active.length) * 100) : 100}%`} hint={`${compliant} of ${active.length} active volunteers fully current`} icon={ShieldCheck} />
        <StatTile label="Month-on-month retention" value={`${retention.filter((r) => !r.na).slice(-1)[0]?.value ?? 0}%`} hint="Of last month's active volunteers, share active again this month" icon={Repeat} />
      </div>

      <div className="grid grid-cols-1 gap-6 @4xl/admin:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-xl text-ink">Volunteer hours per month</h2>
          <p className="mb-4 text-sm text-muted-foreground">Attended shift hours. The current month is partial.</p>
          <BarChart title="Volunteer hours per month" labelHeader="Month" valueHeader="Hours" data={byMonth.map((b) => ({ label: formatMonthShort(b.m), sublabel: formatMonth(b.m), value: Math.round(b.hours), muted: b.isCurrent }))} unit=" h" />
        </section>
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-xl text-ink">Active volunteers per month</h2>
          <p className="mb-4 text-sm text-muted-foreground">Distinct people who attended at least one shift.</p>
          <BarChart title="Active volunteers per month" labelHeader="Month" valueHeader="Volunteers" data={byMonth.map((b) => ({ label: formatMonthShort(b.m), sublabel: formatMonth(b.m), value: b.active.size, muted: b.isCurrent }))} />
        </section>
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-xl text-ink">No-shows per month</h2>
          <p className="mb-4 text-sm text-muted-foreground">Rostered volunteers marked as not attending. Sickness reported in advance is an absence, not a no-show.</p>
          <BarChart title="No-shows per month" labelHeader="Month" valueHeader="No-shows" tone="orange" data={byMonth.map((b) => ({ label: formatMonthShort(b.m), sublabel: formatMonth(b.m), value: b.noShows, muted: b.isCurrent }))} />
        </section>
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-xl text-ink">Training compliance by module</h2>
          <p className="mb-4 text-sm text-muted-foreground">Share of volunteers who need the module and are current on it.</p>
          <HorizontalBarChart title="Training compliance by module" tone="green" data={moduleCompliance} unit="%" max={100} />
        </section>
      </div>
    </div>
  );
}
