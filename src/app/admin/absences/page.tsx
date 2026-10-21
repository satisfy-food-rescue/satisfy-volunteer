import Link from "next/link";
import { CheckCircle2, HandHelping } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { shiftName } from "@/lib/roster";
import { db } from "@/lib/db";
import { addDays, dateToISO, formatDay, formatDayShort, isoToDate, todayISO, weekMonday, workWeek, WEEKDAY_SHORT, weekdayOf } from "@/lib/dates";
import { ABSENCE_REASON_LABEL, fullName } from "@/lib/domain";
import { PageHeader } from "@/components/shared/page-header";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { AbsenceReasonChip } from "@/components/admin/absence-reason-chip";
import { RecordAbsenceForm } from "@/components/admin/record-absence-form";
import { cn } from "@/lib/utils";

export const metadata = { title: "Absences" };

// Fades at whichever edge has more to scroll to. The first two layers move
// with the content and cover the shadows once an edge is reached.
const SCROLL_SHADOWS = [
  "linear-gradient(to right, var(--card) 30%, transparent) left / 2.5rem 100% no-repeat local",
  "linear-gradient(to left, var(--card) 30%, transparent) right / 2.5rem 100% no-repeat local",
  "radial-gradient(farthest-side at 0 50%, rgb(0 0 0 / 18%), transparent) left / 0.875rem 100% no-repeat scroll",
  "radial-gradient(farthest-side at 100% 50%, rgb(0 0 0 / 18%), transparent) right / 0.875rem 100% no-repeat scroll",
  "var(--card)",
].join(", ");

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
      <PageHeader eyebrow="Roster" title="Absences" description="Who is away over the four weeks from this Monday, and what it leaves open. Each bar is an absence; underneath are the shifts it released and whether someone has covered them." />

      {/* Four weeks fit beside the sidebar from a 1024px window. Narrower, the
          grid scrolls sideways: the volunteer column stays put, a shadow at
          the right edge shows there is more, and a line below says so. */}
      <div className="flex flex-col gap-2">
        <div className="overflow-x-auto rounded-2xl border border-border bg-card" style={{ background: SCROLL_SHADOWS }}>
          <table className="w-full min-w-[42rem] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-56" />
              {days.map((iso) => <col key={iso} />)}
            </colgroup>
            <thead>
              <tr className="bg-muted">
                <th scope="col" rowSpan={2} className="font-display sticky left-0 z-10 border-b border-border bg-muted px-3 py-2 text-left align-bottom text-xs font-bold uppercase tracking-wide text-muted-foreground">Volunteer</th>
                {weeks.map((week) => (
                  <th key={week[0]} scope="colgroup" colSpan={5} className="border-l-2 border-border px-1.5 pt-2 text-left text-xs font-semibold text-ink-soft">
                    <span className="sr-only">Week of </span>{formatDayShort(week[0])}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-border bg-muted">
                {days.map((iso) => (
                  <th key={iso} scope="col" className={cn("font-display px-0 pb-1.5 pt-1 text-center text-xs font-bold leading-tight text-muted-foreground", weekdayOf(iso) === 1 && "border-l-2 border-border", iso === today && "text-teal")}>
                    <span aria-hidden>{WEEKDAY_SHORT[weekdayOf(iso)].charAt(0)}</span>
                    <span className="sr-only">{WEEKDAY_SHORT[weekdayOf(iso)]}</span>
                    <span className="block tabular">{Number(iso.slice(8))}</span>
                    {iso === today && <span className="sr-only"> (today)</span>}
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
                    <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-2.5 text-left font-normal">
                      <div className="flex items-center gap-2">
                        <AvatarBadge person={a.volunteer} size="sm" />
                        <div className="min-w-0">
                          <Link href={`/admin/volunteers/${a.volunteerId}`} className="block truncate font-bold text-ink hover:underline">{fullName(a.volunteer)}</Link>
                          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                            <AbsenceReasonChip reason={a.reason} />
                            <span className="whitespace-nowrap tabular">{s === e ? formatDayShort(s) : `${formatDayShort(s)} to ${formatDayShort(e)}`}</span>
                          </div>
                        </div>
                      </div>
                      {released.length > 0 && (
                        <ul className="mt-2 flex flex-col gap-1.5">
                          {released.map((r) => {
                            const confirmed = r.shift.assignments.filter((x) => x.status === "CONFIRMED" || x.status === "ATTENDED").length;
                            const covered = confirmed >= r.shift.needed;
                            return (
                              <li key={r.id}>
                                <Link href={`/admin/roster/${r.shiftId}`} className="group/rel flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                                  <span className="font-semibold text-ink-soft group-hover/rel:underline">
                                    {formatDay(dateToISO(r.shift.date))} · {r.shift.template.kind === "WAREHOUSE" ? "Warehouse" : r.shift.template.kind === "HARVEST" ? shiftName(r.shift) : r.shift.template.name.split(": ")[1]}
                                  </span>
                                  <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 font-semibold", covered ? "bg-status-good-bg text-status-good" : "bg-status-warn-bg text-status-warn")}>
                                    {covered ? <CheckCircle2 className="size-3" aria-hidden /> : <HandHelping className="size-3" aria-hidden />}
                                    {covered ? "Covered" : "Needs cover"}
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {released.length === 0 && <p className="mt-1.5 text-xs text-muted-foreground">No rostered shifts affected.</p>}
                    </th>
                    {days.map((iso) => {
                      const inRange = iso >= s && iso <= e;
                      const rel = released.find((r) => dateToISO(r.shift.date) === iso);
                      const covered = rel ? rel.shift.assignments.filter((x) => x.status === "CONFIRMED" || x.status === "ATTENDED").length >= rel.shift.needed : false;
                      // Each away day says so in words, so the bar is not read by colour alone.
                      const label = rel ? `Away. ${shiftName(rel.shift)} ${covered ? "covered" : "needs cover"}` : `Away (${ABSENCE_REASON_LABEL[a.reason].toLowerCase()})`;
                      // A bar is rounded where the absence starts and ends, and at
                      // the week's edges so the gap between weeks reads as a break.
                      const starts = iso === s || weekdayOf(iso) === 1;
                      const ends = iso === e || weekdayOf(iso) === 5;
                      return (
                        <td key={iso} className={cn("h-12 px-0 py-2", weekdayOf(iso) === 1 && "border-l-2 border-border", iso === today && "bg-teal-tint-soft")}>
                          {inRange && (
                            <div
                              className={cn("flex h-7 items-center justify-center", starts && "ml-0.5 rounded-l-full", ends && "mr-0.5 rounded-r-full", rel ? (covered ? "bg-green" : "bg-orange") : "bg-muted-foreground/25")}
                              title={label}
                            >
                              <span className="sr-only">{label}</span>
                              {rel && (covered ? <CheckCircle2 className="size-4 text-white" aria-hidden /> : <HandHelping className="size-4 text-ink" aria-hidden />)}
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
        <p className="text-xs text-muted-foreground @2xl/admin:hidden">Scroll sideways to see all four weeks.</p>
      </div>
      <p className="-mt-5 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-6 rounded-full bg-muted-foreground/25" aria-hidden /> Away, no shift that day</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-flex h-3 w-6 items-center justify-center rounded-full bg-orange" aria-hidden /> Released shift, needs cover</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-flex h-3 w-6 items-center justify-center rounded-full bg-green" aria-hidden /> Released shift, covered</span>
      </p>

      <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="rec-h">
        <h2 id="rec-h" className="text-2xl text-ink">Record an absence</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">For volunteers who phone in rather than using the app. Releases their shifts and sends them the same confirmation email.</p>
        <RecordAbsenceForm today={today} volunteers={volunteers.map((v) => ({ id: v.id, name: fullName(v) }))} />
      </section>
    </div>
  );
}
