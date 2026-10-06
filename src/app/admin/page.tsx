import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, Clock, HandHelping, Inbox, Users } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { addDays, formatDay, formatDayLong, formatInstant, relativeDay, todayISO, weekMonday, formatDate } from "@/lib/dates";
import { shiftsBetween } from "@/lib/roster";
import { moduleStatuses, trainingSummary } from "@/lib/training";
import { fullName } from "@/lib/domain";
import { PageHeader } from "@/components/shared/page-header";
import { StatTile } from "@/components/admin/stat-tile";
import { ShiftRow } from "@/components/admin/shift-row";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { TrainingChip } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const user = await requireAdmin();
  const today = todayISO();
  const monday = weekMonday(today);
  const [week, fortnight, volunteers, modules, applications, sessions] = await Promise.all([
    shiftsBetween(monday, addDays(monday, 4)),
    shiftsBetween(today, addDays(today, 14)),
    db.volunteer.findMany({ where: { status: "ACTIVE", role: "VOLUNTEER" }, include: { trainingRecords: true } }),
    db.trainingModule.findMany({ orderBy: { order: "asc" } }),
    db.application.findMany({ where: { status: "PENDING" }, orderBy: { submittedAt: "desc" } }),
    db.trainingSession.findMany({ where: { startsAt: { gte: new Date() } }, include: { module: true, rsvps: true }, orderBy: { startsAt: "asc" }, take: 3 }),
  ]);
  const todays = week.filter((s) => s.iso === today);
  const gaps = fortnight.filter((s) => s.isGap);
  const attention = volunteers
    .map((v) => ({ v, statuses: moduleStatuses(v, modules, v.trainingRecords, today) }))
    .map((x) => ({ ...x, summary: trainingSummary(x.statuses) }))
    .filter((x) => x.summary.overdue > 0 || x.summary.dueSoon > 0 || x.summary.notStarted > 0)
    .sort((a, b) => b.summary.overdue - a.summary.overdue || b.summary.notStarted - a.summary.notStarted || b.summary.dueSoon - a.summary.dueSoon);
  const overdueCount = attention.filter((x) => x.summary.overdue > 0).length;
  const compliant = volunteers.length - attention.filter((x) => !x.summary.compliant).length;
  const onToday = todays.reduce((n, s) => n + s.confirmedCount, 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        eyebrow={formatDayLong(today)}
        title={`Kia ora, ${user.firstName}`}
        description={
          todays.length === 0
            ? "No shifts today. Here is the week ahead."
            : `${onToday} volunteers across ${todays.length} shifts today.`
        }
        actions={<Button size="lg" className="h-11" render={<Link href="/admin/roster/bulk" />}><CalendarDays className="size-4" /> Bulk schedule</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Gaps, next 14 days" value={gaps.length} hint={gaps[0] ? `Next: ${formatDay(gaps[0].iso)}` : "Everything covered"} icon={HandHelping} tone={gaps.length ? "bad" : "good"} href="/admin/roster" />
        <StatTile label="Overdue training" value={overdueCount} hint={`${attention.filter((x) => x.summary.dueSoon > 0).length} more due within 30 days`} icon={AlertTriangle} tone={overdueCount ? "warn" : "good"} href="/admin/training?tab=people&status=OVERDUE" />
        <StatTile label="Pending applications" value={applications.length} hint={applications[0] ? `Latest ${relativeDay(todayISO(applications[0].submittedAt), today).toLowerCase()}` : "Queue is clear"} icon={Inbox} tone={applications.length ? "info" : "neutral"} href="/admin/applications" />
        <StatTile label="Training compliance" value={`${Math.round((compliant / volunteers.length) * 100)}%`} hint={`${compliant} of ${volunteers.length} active volunteers current`} icon={Users} tone="neutral" href="/admin/reports" />
      </div>

      <div className="grid grid-cols-1 gap-8 @4xl/admin:grid-cols-5">
        <section className="flex flex-col gap-3 @4xl/admin:col-span-3" aria-labelledby="today-h">
          <div className="flex items-baseline justify-between">
            <h2 id="today-h" className="text-2xl text-ink">Today&apos;s roster</h2>
            <Link href="/admin/roster" className="text-sm font-semibold text-green-text hover:underline">Full roster</Link>
          </div>
          {todays.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-muted-foreground">
              {today > addDays(monday, 4) ? "No shifts at the weekend. Monday's roster is ready." : "Nothing scheduled today."}
            </div>
          ) : (
            <div className="flex flex-col gap-2">{todays.map((s) => <ShiftRow key={s.shift.id} view={s} />)}</div>
          )}

          <div className="mt-4 flex items-baseline justify-between">
            <h2 className="text-2xl text-ink">Coverage gaps</h2>
            <span className="text-sm text-muted-foreground">Next two weeks</span>
          </div>
          {gaps.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-muted-foreground">Every shift has its minimum crew. Ka pai.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {gaps.map((s) => (
                <div key={s.shift.id} className="flex flex-col gap-1">
                  <ShiftRow view={s} showDate={formatDay(s.iso)} />
                  <p className="pl-3 text-xs text-muted-foreground">{s.causes.join(". ")}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-8 @4xl/admin:col-span-2">
          <section className="flex flex-col gap-3" aria-labelledby="training-h">
            <div className="flex items-baseline justify-between">
              <h2 id="training-h" className="text-2xl text-ink">Training attention</h2>
              <Link href="/admin/training?tab=people" className="text-sm font-semibold text-green-text hover:underline">All</Link>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {attention.slice(0, 7).map(({ v, statuses, summary }) => {
                const worst = statuses.find((s) => s.status === summary.worst);
                return (
                  <li key={v.id}>
                    <Link href={`/admin/volunteers/${v.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted">
                      <AvatarBadge person={v} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink">{fullName(v)}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {worst?.module.name}
                          {worst?.expiresISO ? ` · ${worst.status === "OVERDUE" ? "expired" : "expires"} ${formatDate(worst.expiresISO)}` : ""}
                        </span>
                      </span>
                      <TrainingChip status={summary.worst} size="sm" />
                    </Link>
                  </li>
                );
              })}
              {attention.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Everyone is current.</li>}
            </ul>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="apps-h">
            <div className="flex items-baseline justify-between">
              <h2 id="apps-h" className="text-2xl text-ink">Applications</h2>
              <Link href="/admin/applications" className="text-sm font-semibold text-green-text hover:underline">Review</Link>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {applications.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/applications#${a.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted">
                    <AvatarBadge person={a} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{a.firstName} {a.lastName}</span>
                      <span className="block truncate text-xs text-muted-foreground">{a.suburb} · via Infoodle form · {relativeDay(todayISO(a.submittedAt), today)}</span>
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
              {applications.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">No pending applications.</li>}
            </ul>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="sessions-h">
            <h2 id="sessions-h" className="text-2xl text-ink">Upcoming training</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link href={`/admin/training/sessions/${s.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-green-tint-soft text-green-text"><Clock className="size-4" aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{s.module.name}</span>
                      <span className="block text-xs text-muted-foreground tabular">{formatInstant(s.startsAt)} · {s.rsvps.filter((r) => r.status === "GOING").length}/{s.capacity} booked</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
