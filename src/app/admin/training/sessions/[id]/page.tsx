import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarPlus, ChevronLeft, Clock, MapPin, Users } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { ACTIVE_POOL } from "@/lib/pool";
import { formatInstantRange, addMonths, todayISO, formatDate, nzClock } from "@/lib/dates";
import { fullName } from "@/lib/domain";
import { moduleStatuses } from "@/lib/training";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { Chip } from "@/components/shared/status-chip";
import { AttendanceToggle, CancelSessionButton, EditSessionButton } from "@/components/admin/training-admin-controls";
import { TrainingCommentButton } from "@/components/admin/volunteer-admin-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Training session" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const s = await db.trainingSession.findUnique({ where: { id }, include: { module: true, records: true, rsvps: { include: { volunteer: true }, orderBy: { createdAt: "asc" } } } });
  if (!s) notFound();
  const going = s.rsvps.filter((r) => r.status === "GOING");
  const declined = s.rsvps.filter((r) => r.status === "DECLINED");
  const sessionISO = todayISO(s.startsAt);
  const nextDue = s.module.validityMonths ? addMonths(sessionISO, s.module.validityMonths) : null;
  const isPast = s.startsAt < new Date();
  // Who could book it: everyone the module applies to who is not current on it.
  const [modules, volunteers] = going.length === 0 && !isPast
    ? await Promise.all([db.trainingModule.findMany(), db.volunteer.findMany({ where: ACTIVE_POOL, include: { trainingRecords: true } })])
    : [[], []];
  const needing = volunteers.filter((v) => {
    const st = moduleStatuses(v, modules, v.trainingRecords, todayISO()).find((x) => x.module.id === s.moduleId);
    return st?.required && st.status !== "COMPLETE";
  }).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Link href="/admin/training?tab=sessions" className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-ink"><ChevronLeft className="size-5" aria-hidden /> Sessions</Link>
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Training session</p>
            <h1 className="mt-1 text-3xl text-ink @4xl/admin:text-4xl">{s.module.name}</h1>
          </div>
          {!isPast && (
            <div className="flex flex-wrap gap-2">
              <EditSessionButton
                sessionId={s.id}
                today={todayISO()}
                booked={going.length}
                initial={{ date: sessionISO, startTime: nzClock(s.startsAt), endTime: nzClock(s.endsAt), location: s.location, capacity: s.capacity, notes: s.notes ?? "" }}
              />
              <CancelSessionButton sessionId={s.id} label={`${s.module.name}, ${formatInstantRange(s.startsAt, s.endsAt)}`} booked={going.length} />
            </div>
          )}
        </div>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-ink-soft">
          <span className="inline-flex items-center gap-1.5 tabular"><Clock className="size-4 text-sky" aria-hidden />{formatInstantRange(s.startsAt, s.endsAt)}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin className="size-4 text-sky" aria-hidden />{s.location}</span>
          <span className="inline-flex items-center gap-1.5 tabular"><Users className="size-4 text-sky" aria-hidden />{going.length} of {s.capacity} booked</span>
        </p>
        {s.notes && <p className="mt-2 text-sm text-muted-foreground">{s.notes}</p>}
      </header>

      <section className="rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-xl text-ink">RSVPs</h2>
          <p className="text-sm text-muted-foreground">Marking attended sets the completion date to {formatDate(sessionISO)}{nextDue ? ` and the next due date to ${formatDate(nextDue)}` : ""}.</p>
        </div>
        {going.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title={isPast ? "Nobody was booked" : "Nobody booked yet"}
            description={isPast ? "Nobody booked this session in the app." : `Volunteers book this session in the app. ${needing} ${needing === 1 ? "volunteer still needs" : "volunteers still need"} ${s.module.name}.`}
            action={!isPast && needing > 0 && (
              <Button variant="outline" size="lg" className="bg-card" render={<Link href={`/admin/training?tab=people&module=${s.moduleId}`} />}>
                <Users className="size-4" /> See who needs it
              </Button>
            )}
            className="m-4 border-0 bg-transparent py-8"
          />
        ) : (
          <ul className="divide-y divide-border">
            {going.map((r) => {
              const record = r.attendedAt ? s.records.find((x) => x.volunteerId === r.volunteerId) : undefined;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <AvatarBadge person={r.volunteer} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/volunteers/${r.volunteerId}`} className="block truncate font-bold text-ink hover:underline">{fullName(r.volunteer)}</Link>
                    {record?.comment && <p className="whitespace-pre-line text-sm text-ink-soft">{record.comment}</p>}
                  </div>
                  {r.attendedAt && <Chip tone="good" size="sm" icon={BadgeCheck}>Record updated</Chip>}
                  {record && <TrainingCommentButton recordId={record.id} comment={record.comment} moduleName={s.module.name} firstName={r.volunteer.firstName} />}
                  <AttendanceToggle rsvpId={r.id} attended={!!r.attendedAt} />
                </li>
              );
            })}
          </ul>
        )}
        {declined.length > 0 && <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Can&apos;t make it: {declined.map((r) => fullName(r.volunteer)).join(", ")}</p>}
      </section>
    </div>
  );
}
