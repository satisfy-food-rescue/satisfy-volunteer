import Link from "next/link";
import { CheckCircle2, HandHelping } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { addDays, dateToISO, formatDay, formatDayShort, isoToDate, todayISO, weekMonday, workWeek, WEEKDAY_SHORT, weekdayOf } from "@/lib/dates";
import { ABSENCE_REASON_LABEL, fullName, type AbsenceReason } from "@/lib/domain";
import { PageHeader } from "@/components/shared/page-header";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { Chip } from "@/components/shared/status-chip";
import { RecordAbsenceForm } from "@/components/admin/record-absence-form";
import { cn } from "@/lib/utils";

export const metadata = { title: "Absences" };

const REASON_TONE: Record<AbsenceReason, "warn" | "bad" | "neutral"> = { HOLIDAY: "warn", SICK: "bad", OTHER: "neutral" };

export default async function AbsencesPage() {
  await requireAdmin();
  const today = todayISO();
  const from = weekMonday(today);
  const weeks = [0, 1, 2, 3].map((i) => workWeek(addDays(from, i * 7)));
  const to = weeks[3][4];
  const [absences, volunteers] = await Promise.all([
    db.absence.findMany({
      where: { endDate: { gte: isoToDate(from) }, startDate: { lte: isoToDate(to) } },
      include: { volunteer: true, releasedAssignments: { include: { shift: { include: { template: true, assignments: true } } } } },
      orderBy: { startDate: "asc" },
    }),
    db.volunteer.findMany({ where: { status: "ACTIVE", role: "VOLUNTEER" }, orderBy: [{ firstName: "asc" }], select: { id: true, firstName: true, lastName: true } }),
  ]);
  const days = weeks.flat();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <PageHeader eyebrow="Absences" title="Who is away, and what it leaves open" description="Four weeks from this Monday. Each bar is an absence; the chips underneath show the shifts it released and whether someone has covered them." />

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60">
              <th className="sticky left-0 z-10 bg-muted/60 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">Volunteer</th>
              {days.map((iso) => (
                <th key={iso} className={cn("px-0.5 py-2 text-center text-[0.65rem] font-bold uppercase leading-tight text-muted-foreground", iso === today && "text-green-text")}>
                  {WEEKDAY_SHORT[weekdayOf(iso)]}<br /><span className="text-xs tabular">{Number(iso.slice(8))}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {absences.length === 0 && (
              <tr><td colSpan={days.length + 1} className="px-4 py-8 text-center text-muted-foreground">Nobody is away in this window.</td></tr>
            )}
            {absences.map((a) => {
              const s = dateToISO(a.startDate);
              const e = dateToISO(a.endDate);
              const released = a.releasedAssignments.filter((r) => r.status === "RELEASED");
              return (
                <tr key={a.id} className="align-top">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <AvatarBadge person={a.volunteer} size="sm" />
                      <div className="min-w-0">
                        <Link href={`/admin/volunteers/${a.volunteerId}`} className="block truncate font-bold text-ink hover:underline">{fullName(a.volunteer)}</Link>
                        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          <Chip tone={REASON_TONE[a.reason as AbsenceReason]} size="sm">{ABSENCE_REASON_LABEL[a.reason as AbsenceReason]}</Chip>
                          <span className="tabular">{s === e ? formatDayShort(s) : `${formatDayShort(s)} to ${formatDayShort(e)}`}</span>
                        </div>
                      </div>
                    </div>
                    {released.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1">
                        {released.map((r) => {
                          const confirmed = r.shift.assignments.filter((x) => x.status === "CONFIRMED" || x.status === "ATTENDED").length;
                          const covered = confirmed >= r.shift.needed;
                          return (
                            <li key={r.id}>
                              <Link href={`/admin/roster/${r.shiftId}`} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold hover:underline", covered ? "bg-status-good-bg text-status-good" : "bg-status-bad-bg text-status-bad")}>
                                {covered ? <CheckCircle2 className="size-3" aria-hidden /> : <HandHelping className="size-3" aria-hidden />}
                                {formatDay(dateToISO(r.shift.date))} · {r.shift.template.kind === "WAREHOUSE" ? "Warehouse" : r.shift.template.name.split(": ")[1]} · {covered ? "covered" : "open"}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {released.length === 0 && <p className="mt-1.5 text-xs text-muted-foreground">No rostered shifts affected.</p>}
                  </td>
                  {days.map((iso) => {
                    const inRange = iso >= s && iso <= e;
                    const rel = released.find((r) => dateToISO(r.shift.date) === iso);
                    const covered = rel ? rel.shift.assignments.filter((x) => x.status === "CONFIRMED" || x.status === "ATTENDED").length >= rel.shift.needed : false;
                    return (
                      <td key={iso} className={cn("h-12 px-0.5 py-2", iso === today && "bg-green-tint-soft/60")}>
                        {inRange && (
                          <div
                            className={cn("flex h-7 items-center justify-center", iso === s && "rounded-l-full", iso === e && "rounded-r-full", rel ? (covered ? "bg-status-good/80" : "bg-status-bad") : "bg-muted-foreground/25")}
                            title={rel ? `${rel.shift.template.name} ${covered ? "covered" : "needs cover"}` : ABSENCE_REASON_LABEL[a.reason as AbsenceReason]}
                          >
                            {rel && (covered ? <CheckCircle2 className="size-4 text-white" aria-label="Covered" /> : <HandHelping className="size-4 text-white" aria-label="Needs cover" />)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="-mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-6 rounded-full bg-muted-foreground/25" /> Away, no shift that day</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-flex h-3 w-6 items-center justify-center rounded-full bg-status-bad" /> Released shift, still open</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-flex h-3 w-6 items-center justify-center rounded-full bg-status-good/80" /> Released shift, covered</span>
      </p>

      <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="rec-h">
        <h2 id="rec-h" className="text-2xl text-ink">Record an absence</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">For volunteers who phone in rather than using the app. Releases their shifts and sends them the same confirmation email.</p>
        <RecordAbsenceForm today={today} volunteers={volunteers.map((v) => ({ id: v.id, name: fullName(v) }))} />
      </section>
    </div>
  );
}
