import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, CheckCircle2, ChevronLeft, Mail, MapPin, Phone, RefreshCw, Sprout, XCircle, Zap, HeartPulse } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { dateToISO, formatDate, formatDay, formatInstant, formatTimeRange, todayISO, WEEKDAY_LONG } from "@/lib/dates";
import { ABSENCE_REASON_LABEL, DELIVERY_LABEL, fullName, parseRoles, type AbsenceReason, type Delivery } from "@/lib/domain";
import { moduleStatuses, trainingSummary } from "@/lib/training";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { Chip, TrainingChip } from "@/components/shared/status-chip";
import { NotesEditor, RecordCompletionButton, RolesEditor } from "@/components/admin/volunteer-admin-controls";
import { RecordAbsenceForm } from "@/components/admin/record-absence-form";
import { cn } from "@/lib/utils";

export const metadata = { title: "Volunteer" };

export default async function VolunteerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const today = todayISO();
  const [v, modules] = await Promise.all([
    db.volunteer.findUnique({
      where: { id },
      include: {
        trainingRecords: { include: { session: true }, orderBy: { completedAt: "desc" } },
        regularSlots: { include: { template: true }, orderBy: { weekday: "asc" } },
        absences: { orderBy: { startDate: "desc" }, take: 6 },
        assignments: { where: { status: { in: ["ATTENDED", "NO_SHOW", "CONFIRMED", "RELEASED"] } }, include: { shift: { include: { template: true } } }, orderBy: { shift: { date: "desc" } }, take: 200 },
      },
    }),
    db.trainingModule.findMany({ orderBy: { order: "asc" } }),
  ]);
  if (!v) notFound();
  const statuses = moduleStatuses(v, modules, v.trainingRecords, today);
  const summary = trainingSummary(statuses);
  const history = v.assignments.filter((a) => dateToISO(a.shift.date) < today);
  const attended = history.filter((a) => a.status === "ATTENDED").length;
  const noShows = history.filter((a) => a.status === "NO_SHOW").length;
  const upcoming = v.assignments.filter((a) => dateToISO(a.shift.date) >= today && a.status === "CONFIRMED").sort((a, b) => a.shift.date.getTime() - b.shift.date.getTime()).slice(0, 4);
  const hours = history.filter((a) => a.status === "ATTENDED").reduce((n, a) => { const [sh, sm] = a.shift.startTime.split(":").map(Number); const [eh, em] = a.shift.endTime.split(":").map(Number); return n + (eh * 60 + em - sh * 60 - sm) / 60; }, 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Link href="/admin/volunteers" className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-ink"><ChevronLeft className="size-5" aria-hidden /> Volunteers</Link>

      <header className="flex flex-wrap items-start gap-5 rounded-2xl border border-border bg-card p-5">
        <AvatarBadge person={v} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl text-ink">{fullName(v)}</h1>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
            {v.suburb && <span className="inline-flex items-center gap-1"><MapPin className="size-4 text-green-text" aria-hidden />{v.suburb}{v.birthYear ? `, ${new Date().getFullYear() - v.birthYear}` : ""}</span>}
            {v.phone && <span className="inline-flex items-center gap-1 tabular"><Phone className="size-4 text-green-text" aria-hidden />{v.phone}</span>}
            <span className="inline-flex items-center gap-1"><Mail className="size-4 text-green-text" aria-hidden />{v.email}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <TrainingChip status={summary.worst} size="sm" />
            {v.isRegular && <Chip tone="good" size="sm" icon={CalendarCheck}>Regular</Chip>}
            {v.inHarvestPool && <Chip tone="info" size="sm" icon={Sprout}>Harvest pool</Chip>}
            {v.lastMinuteOk && <Chip tone="neutral" size="sm" icon={Zap}>Last-minute OK</Chip>}
            <span className="text-xs text-muted-foreground">Joined {formatDate(dateToISO(v.joinedAt))}</span>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-4 text-center">
          {[["Shifts", attended], ["Hours", Math.round(hours)], ["No-shows", noShows]].map(([l, n]) => (
            <div key={l}><dd className="font-display text-2xl text-ink tabular">{n}</dd><dt className="text-xs font-semibold text-muted-foreground">{l}</dt></div>
          ))}
        </dl>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="flex flex-col gap-6 lg:col-span-3">
          <section className="flex flex-col gap-3" aria-labelledby="tr-h">
            <h2 id="tr-h" className="text-2xl text-ink">Training record</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {statuses.filter((s) => s.required).map((s) => (
                <li key={s.module.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink">{s.module.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.module.validityMonths ? `${s.module.validityMonths}-month validity` : "Once only"} · {DELIVERY_LABEL[s.module.delivery as Delivery]}
                      {s.completedISO && ` · completed ${formatDate(s.completedISO)}${s.record?.method === "SESSION" ? " (session)" : s.record?.method === "ONLINE" ? " (online)" : s.record?.method === "COORDINATOR" ? " (coordinator)" : ""}`}
                    </p>
                    {s.expiresISO && <p className={cn("text-xs tabular", s.status === "OVERDUE" ? "text-status-bad" : s.status === "DUE_SOON" ? "text-status-warn" : "text-muted-foreground")}>{s.status === "OVERDUE" ? "Expired" : "Expires"} {formatDate(s.expiresISO)}</p>}
                  </div>
                  <TrainingChip status={s.status} size="sm" />
                  {s.status !== "COMPLETE" && <RecordCompletionButton volunteerId={v.id} moduleId={s.module.id} moduleName={s.module.name} />}
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="att-h">
            <h2 id="att-h" className="text-2xl text-ink">Attendance history</h2>
            {history.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">No shifts yet.</p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {history.slice(0, 12).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-24 shrink-0 text-muted-foreground tabular">{formatDay(dateToISO(a.shift.date))}</span>
                    <Link href={`/admin/roster/${a.shiftId}`} className="min-w-0 flex-1 truncate font-semibold text-ink hover:underline">{a.shift.template.name}</Link>
                    {a.status === "ATTENDED" && <Chip tone="good" size="sm" icon={CheckCircle2}>Attended</Chip>}
                    {a.status === "NO_SHOW" && <Chip tone="bad" size="sm" icon={XCircle}>No-show</Chip>}
                    {a.status === "RELEASED" && <Chip tone="neutral" size="sm">Away</Chip>}
                    {a.status === "CONFIRMED" && <Chip tone="neutral" size="sm">Not marked</Chip>}
                  </li>
                ))}
                {history.length > 12 && <li className="px-4 py-2 text-xs text-muted-foreground">Showing the last 12 of {history.length}.</li>}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="slot-h">
            <h2 id="slot-h" className="text-xl text-ink">Regular slot</h2>
            {v.regularSlots.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No regular slot. Books one-off shifts.</p> : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {v.regularSlots.map((s) => <li key={s.id} className="rounded-xl bg-green-tint-soft px-3 py-2 text-sm"><span className="font-bold text-ink">{WEEKDAY_LONG[s.weekday]}s</span> · {s.template.name} · <span className="tabular">{formatTimeRange(s.template.startTime, s.template.endTime)}</span></li>)}
              </ul>
            )}
            {upcoming.length > 0 && (
              <>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Next up</p>
                <ul className="mt-1 text-sm text-ink-soft">{upcoming.map((a) => <li key={a.id} className="tabular">{formatDay(dateToISO(a.shift.date))} · {a.shift.template.kind === "WAREHOUSE" ? "Warehouse" : a.shift.template.name.split(": ")[1]}</li>)}</ul>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="roles-h">
            <h2 id="roles-h" className="text-xl text-ink">Roles</h2>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">Roles decide which shift types and training modules apply.</p>
            <RolesEditor volunteerId={v.id} initial={parseRoles(v.roles)} />
          </section>

          <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="ec-h">
            <h2 id="ec-h" className="flex items-center gap-2 text-xl text-ink"><HeartPulse className="size-5 text-green-text" aria-hidden /> Emergency contact</h2>
            <p className="mt-2 text-sm text-ink">{v.emergencyName ?? <span className="text-muted-foreground">Not provided</span>}</p>
            {v.emergencyPhone && <p className="text-sm text-ink-soft tabular">{v.emergencyPhone}</p>}
            {v.availabilityNote && <><p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Availability</p><p className="text-sm text-ink-soft">{v.availabilityNote}</p></>}
          </section>

          <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="notes-h">
            <h2 id="notes-h" className="text-xl text-ink">Coordinator notes</h2>
            <div className="mt-2"><NotesEditor volunteerId={v.id} initial={v.notes ?? ""} /></div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="abs-h">
            <h2 id="abs-h" className="text-xl text-ink">Absences</h2>
            {v.absences.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">None recorded.</p> : (
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {v.absences.map((a) => <li key={a.id} className="flex items-center justify-between gap-2"><span className="tabular">{formatDay(dateToISO(a.startDate))} to {formatDay(dateToISO(a.endDate))}</span><Chip tone="neutral" size="sm">{ABSENCE_REASON_LABEL[a.reason as AbsenceReason]}</Chip></li>)}
              </ul>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-green-text">Record an absence for {v.firstName}</summary>
              <div className="mt-3"><RecordAbsenceForm today={today} defaultVolunteerId={v.id} volunteers={[{ id: v.id, name: fullName(v) }]} /></div>
            </details>
          </section>

          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
            <RefreshCw className="size-4 text-green-text" aria-hidden />
            <span className="text-ink">Infoodle {v.infoodleId}</span>
            <span className="ml-auto text-xs text-muted-foreground">{v.infoodleSyncedAt ? `synced ${formatInstant(v.infoodleSyncedAt)}` : "not synced"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
