import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock, HandHelping, Mail, MapPin, Smartphone, Store, UserRound, Users, CheckCircle2, XCircle } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { formatDay, formatDayLong, formatInstant, formatTimeRange, relativeDay, todayISO, dateToISO, formatDayRange } from "@/lib/dates";
import { availableForShift, shiftById } from "@/lib/roster";
import { ABSENCE_REASON_LABEL, fullName, type AbsenceReason } from "@/lib/domain";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { Chip } from "@/components/shared/status-chip";
import { ShiftKindIcon } from "@/components/app/shift-card";
import { AddVolunteerPanel, AttendanceControls, CancelShiftButton, SourceChip } from "@/components/admin/shift-admin-controls";
import { cn } from "@/lib/utils";

export const metadata = { title: "Shift" };

export default async function AdminShiftPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const view = await shiftById(id);
  if (!view) notFound();
  const today = todayISO();
  const isPast = view.iso < today;
  const cancelled = view.shift.status === "CANCELLED";
  const [candidates, donors, pushes, cancelNotices] = await Promise.all([
    view.shift.status === "SCHEDULED" && !isPast ? availableForShift(view) : Promise.resolve([]),
    view.shift.template.routeId ? db.donor.findMany({ where: { routeId: view.shift.template.routeId } }) : Promise.resolve([]),
    db.email.findMany({ where: { ref: { startsWith: `last-minute:${id}:` } }, include: { volunteer: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } }),
    cancelled
      ? db.email.findMany({ where: { ref: { startsWith: `shift-cancelled:${id}:` }, channel: "EMAIL" }, include: { volunteer: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
  ]);
  const pushedTo = pushes.flatMap((p) => (p.volunteer ? [fullName(p.volunteer)] : []));
  const toldOfCancellation = cancelNotices.flatMap((e) => (e.volunteer ? [fullName(e.volunteer)] : []));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Link href="/admin/roster" className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-ink">
        <ChevronLeft className="size-5" aria-hidden /> Roster
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl", view.kind === "WAREHOUSE" ? "bg-green-tint text-green-deep" : "bg-sky-tint text-sky-text")}>
            <ShiftKindIcon kind={view.kind} className="size-7" />
          </span>
          <div>
            <p className="eyebrow">{relativeDay(view.iso, today)}</p>
            <h1 className="mt-1 text-3xl text-ink">{view.shift.template.name}</h1>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-ink-soft">
              <span className="inline-flex items-center gap-1.5"><Clock className="size-4 text-sky" aria-hidden />{formatDayLong(view.iso)}, <span className="tabular">{formatTimeRange(view.shift.startTime, view.shift.endTime)}</span></span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="size-4 text-sky" aria-hidden />{view.location}</span>
              {view.shift.template.workingWith && <span className="inline-flex items-center gap-1.5"><UserRound className="size-4 text-sky" aria-hidden />With {view.shift.template.workingWith}</span>}
              {donors.length > 0 && <span className="inline-flex items-center gap-1.5"><Store className="size-4 text-sky" aria-hidden />{donors.map((d) => d.name).join(", ")}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cancelled ? (
            <Chip tone="neutral">Cancelled</Chip>
          ) : view.isGap ? (
            <Chip tone="bad" icon={HandHelping}>Needs {view.shortBy} more</Chip>
          ) : (
            <Chip tone="good" icon={CheckCircle2}>Covered</Chip>
          )}
          {!isPast && view.shift.status === "SCHEDULED" && (
            <CancelShiftButton shiftId={view.shift.id} label={`${view.shift.template.name} on ${formatDay(view.iso)}`} booked={view.shift.assignments.filter((a) => a.status === "CONFIRMED").length} />
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="flex flex-col gap-3 lg:col-span-3" aria-labelledby="assigned-h">
          <div className="flex items-baseline justify-between">
            <h2 id="assigned-h" className="text-2xl text-ink">Assigned</h2>
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground tabular"><Users className="size-4" aria-hidden />{view.confirmedCount} of {view.shift.capacity} · minimum {view.shift.needed}</span>
          </div>
          {view.confirmed.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">Nobody rostered yet.</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {view.confirmed.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <AvatarBadge person={a.volunteer} size="sm" />
                  <span className="min-w-0 flex-1">
                    <Link href={`/admin/volunteers/${a.volunteerId}`} className="block truncate text-sm font-bold text-ink hover:underline">{fullName(a.volunteer)}</Link>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <SourceChip source={a.source} />
                      {a.volunteer.phone && <span className="tabular">{a.volunteer.phone}</span>}
                    </span>
                  </span>
                  {a.status === "ATTENDED" && <Chip tone="good" icon={CheckCircle2} size="sm">Attended</Chip>}
                  {a.status === "NO_SHOW" && <Chip tone="bad" icon={XCircle} size="sm">No-show</Chip>}
                  {view.shift.status === "SCHEDULED" && <AttendanceControls assignmentId={a.id} status={a.status} isPast={isPast || view.iso === today} />}
                </li>
              ))}
            </ul>
          )}

          {view.released.length > 0 && (
            <div className="rounded-2xl border border-orange/50 bg-orange-tint/50 p-4">
              <p className="text-sm font-bold text-orange-text">Released from this shift</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {view.released.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 text-sm text-ink">
                    <AvatarBadge person={r.volunteer} size="sm" className="size-7 text-[0.6rem]" />
                    <span className="font-semibold">{fullName(r.volunteer)}</span>
                    <span className="text-muted-foreground">
                      away {r.absence ? `(${ABSENCE_REASON_LABEL[r.absence.reason as AbsenceReason].toLowerCase()}, ${formatDayRange(dateToISO(r.absence.startDate), dateToISO(r.absence.endDate))})` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-3 lg:col-span-2" aria-labelledby="add-h">
          <h2 id="add-h" className="text-2xl text-ink">{cancelled ? "Cancellation" : view.isGap ? "Find cover" : "Add a volunteer"}</h2>
          {pushedTo.length > 0 && !cancelled && (
            <p className="flex items-start gap-2 rounded-xl bg-orange-tint/60 px-3 py-2.5 text-sm text-ink">
              <Smartphone className="mt-0.5 size-4 shrink-0 text-orange-text" aria-hidden />
              <span>Last-minute notification sent {formatInstant(pushes[0].createdAt)} to {pushedTo.join(", ")}.</span>
            </p>
          )}
          {cancelled && toldOfCancellation.length > 0 ? (
            <p className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5 text-sm text-ink">
              <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>Emailed and sent a push notification {formatInstant(cancelNotices[0].createdAt)}: {toldOfCancellation.join(", ")}.</span>
            </p>
          ) : isPast || cancelled ? (
            <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">This shift is {cancelled ? "cancelled" : "in the past"}.</p>
          ) : (
            <>
              <AddVolunteerPanel
                shiftId={view.shift.id}
                isGap={view.isGap}
                candidates={candidates.map((c) => ({ id: c.volunteer.id, firstName: c.volunteer.firstName, lastName: c.volunteer.lastName, phone: c.volunteer.phone, lastMinuteOk: c.volunteer.lastMinuteOk, coversBefore: c.coversBefore, roles: c.volunteer.roles }))}
              />
              <p className="text-xs text-muted-foreground">Only volunteers who hold the role, have current training, are not away and are not on another shift that day are listed.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
