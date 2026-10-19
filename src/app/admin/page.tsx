import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Clock, GraduationCap, Inbox } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { addDays, formatDay, formatDayLong, formatInstant, isWeekday, isoToDate, relativeDay, todayISO, weekMonday, formatDate } from "@/lib/dates";
import { decorateShift, shiftInclude, shiftsBetween } from "@/lib/roster";
import { moduleStatuses, trainingSummary } from "@/lib/training";
import { applicationSourceLabel, fullName } from "@/lib/domain";
import { PageHeader } from "@/components/shared/page-header";
import { CoverageBoard } from "@/components/admin/coverage-board";
import { ShiftRow } from "@/components/admin/shift-row";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { TrainingChip } from "@/components/shared/status-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const user = await requireAdmin();
  const today = todayISO();
  // The board shows this working week and the next; at the weekend, next
  // week and the one after.
  const monday = isWeekday(today) ? weekMonday(today) : weekMonday(addDays(today, 7));
  const [board, fortnight, volunteers, modules, applications, sessions, harvests] = await Promise.all([
    shiftsBetween(monday, addDays(monday, 11), { drafts: true }),
    shiftsBetween(today, addDays(today, 14)),
    db.volunteer.findMany({ where: { status: "ACTIVE", role: "VOLUNTEER" }, include: { trainingRecords: true } }),
    db.trainingModule.findMany({ orderBy: { order: "asc" } }),
    db.application.findMany({ where: { status: "PENDING" }, orderBy: { submittedAt: "desc" } }),
    db.trainingSession.findMany({ where: { startsAt: { gte: new Date() } }, include: { module: true, rsvps: true }, orderBy: { startsAt: "asc" }, take: 3 }),
    db.shift.findMany({ where: { template: { kind: "HARVEST" }, date: { gte: isoToDate(today) }, status: { not: "CANCELLED" } }, include: shiftInclude, orderBy: [{ date: "asc" }, { startTime: "asc" }], take: 3 }),
  ]);
  const weeks = [0, 7].map((offset, i) => ({
    label: i === 0 ? (monday === weekMonday(today) ? "This week" : "Next week") : monday === weekMonday(today) ? "Next week" : "The week after",
    days: [0, 1, 2, 3, 4].map((d) => addDays(monday, offset + d)),
  }));
  const todays = board.filter((s) => s.iso === today && !s.isDraft);
  const gaps = fortnight.filter((s) => s.isGap);
  const attention = volunteers
    .map((v) => ({ v, statuses: moduleStatuses(v, modules, v.trainingRecords, today) }))
    .map((x) => ({ ...x, summary: trainingSummary(x.statuses) }))
    .filter((x) => x.summary.overdue > 0 || x.summary.dueSoon > 0 || x.summary.notStarted > 0)
    .sort((a, b) => b.summary.overdue - a.summary.overdue || b.summary.notStarted - a.summary.notStarted || b.summary.dueSoon - a.summary.dueSoon);
  const compliant = volunteers.length - attention.filter((x) => !x.summary.compliant).length;
  const compliance = volunteers.length ? Math.round((compliant / volunteers.length) * 100) : 100;
  const onToday = todays.reduce((n, s) => n + s.confirmedCount, 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        eyebrow={formatDayLong(today)}
        title={`Kia ora, ${user.firstName}`}
        description={
          todays.length === 0
            ? isWeekday(today) ? "No shifts today." : "No shifts at the weekend. Here is the roster ahead."
            : `${onToday} ${onToday === 1 ? "volunteer" : "volunteers"} across ${todays.length} ${todays.length === 1 ? "shift" : "shifts"} today.`
        }
        actions={<Button size="lg" className="h-11" render={<Link href="/admin/roster/bulk" />}><CalendarDays className="size-4" /> Bulk schedule</Button>}
      />

      <CoverageBoard weeks={weeks} shifts={board} today={today} />

      <div className="grid grid-cols-1 gap-8 @4xl/admin:grid-cols-5">
        <section className="flex flex-col gap-3 @4xl/admin:col-span-3" aria-labelledby="today-h">
          <div className="flex items-baseline justify-between">
            <h2 id="today-h" className="text-2xl text-ink">Today&apos;s roster</h2>
            <Link href="/admin/roster" className="text-sm font-semibold text-teal hover:underline">Full roster</Link>
          </div>
          {todays.length === 0 ? (
            <EmptyState icon={CalendarDays} title={isWeekday(today) ? "Nothing scheduled today" : "No shifts at the weekend"} className="py-8" />
          ) : (
            <div className="flex flex-col gap-2">{todays.map((s) => <ShiftRow key={s.shift.id} view={s} />)}</div>
          )}

          <div className="mt-4 flex items-baseline justify-between">
            <h2 id="gaps-h" className="text-2xl text-ink">Gaps to fill</h2>
            <span className="text-sm text-muted-foreground">Next 14 days</span>
          </div>
          {gaps.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Every shift has its minimum crew" description="Ka pai. New gaps show up here when someone marks themselves away." className="py-8" />
          ) : (
            <div className="flex flex-col gap-2" aria-labelledby="gaps-h">
              {gaps.map((s) => (
                <ShiftRow key={s.shift.id} view={s} showDate={formatDay(s.iso)} note={s.causes.join(". ")} />
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-8 @4xl/admin:col-span-2">
          <section className="flex flex-col gap-3" aria-labelledby="training-h">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <h2 id="training-h" className="text-2xl text-ink">Training</h2>
                <p className="mt-0.5 text-sm text-muted-foreground tabular">{compliance}% of active volunteers current</p>
              </div>
              <Link href="/admin/training?tab=people" className="shrink-0 text-sm font-semibold text-teal hover:underline">All training</Link>
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
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {worst?.module.name}
                          {worst?.expiresISO ? ` · ${worst.status === "OVERDUE" ? "expired" : "expires"} ${formatDate(worst.expiresISO)}` : ""}
                        </span>
                      </span>
                      <TrainingChip status={summary.worst} size="sm" />
                    </Link>
                  </li>
                );
              })}
              {attention.length === 0 && <li className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground"><GraduationCap className="size-4" aria-hidden />Everyone is current.</li>}
            </ul>
          </section>

          {harvests.length > 0 && (
            <section className="flex flex-col gap-3" aria-labelledby="harvests-h">
              <div className="flex items-baseline justify-between">
                <h2 id="harvests-h" className="text-2xl text-ink">Harvests</h2>
                <Link href="/admin/harvests" className="text-sm font-semibold text-teal hover:underline">All harvests</Link>
              </div>
              <div className="flex flex-col gap-2">
                {harvests.map(decorateShift).map((s) => <ShiftRow key={s.shift.id} view={s} showDate={formatDay(s.iso)} />)}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3" aria-labelledby="apps-h">
            <div className="flex items-baseline justify-between">
              <h2 id="apps-h" className="text-2xl text-ink">
                Applications {applications.length > 0 && <span className="text-base font-semibold text-muted-foreground tabular">({applications.length})</span>}
              </h2>
              <Link href="/admin/applications" className="text-sm font-semibold text-teal hover:underline">Review</Link>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {applications.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/applications#${a.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted">
                    <AvatarBadge person={a} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{a.firstName} {a.lastName}</span>
                      <span className="block truncate text-xs text-muted-foreground">{a.suburb} · {applicationSourceLabel(a.source)} · {relativeDay(todayISO(a.submittedAt), today)}</span>
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
              {applications.length === 0 && <li className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground"><Inbox className="size-4" aria-hidden />No applications waiting.</li>}
            </ul>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="sessions-h">
            <h2 id="sessions-h" className="text-2xl text-ink">Upcoming training</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {sessions.length === 0 && <li className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground"><Clock className="size-4" aria-hidden />No sessions booked. Add one from Training.</li>}
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link href={`/admin/training/sessions/${s.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-tint-soft text-teal"><Clock className="size-4" aria-hidden /></span>
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
