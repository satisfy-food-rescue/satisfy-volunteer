import Link from "next/link";
import { BookOpen, CalendarDays, ChevronRight, MapPin, Users } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { formatDate, formatInstant, formatInstantTime, relativeDays, todayISO } from "@/lib/dates";
import { trainingContext } from "@/lib/volunteer-data";
import { DELIVERY_LABEL } from "@/lib/domain";
import { TrainingChip } from "@/components/shared/status-chip";
import { SessionRsvp } from "@/components/app/session-rsvp";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const metadata = { title: "Training" };

export default async function TrainingPage() {
  const me = await requireVolunteer();
  const today = todayISO();
  const [{ statuses, summary }, sessions] = await Promise.all([
    trainingContext(me, today),
    db.trainingSession.findMany({
      where: { startsAt: { gte: new Date() } },
      include: { module: true, rsvps: true },
      orderBy: { startsAt: "asc" },
    }),
  ]);
  const required = statuses.filter((s) => s.required);
  const notRequired = statuses.filter((s) => !s.required);
  const currentCount = required.filter((s) => s.status === "COMPLETE" || s.status === "DUE_SOON").length;
  const relevantSessions = sessions.filter((s) => {
    const st = statuses.find((x) => x.module.id === s.moduleId);
    return st?.required && st.status !== "COMPLETE";
  });
  const otherSessions = sessions.filter((s) => !relevantSessions.includes(s));

  return (
    <div className="flex flex-col gap-6 px-5 pb-6 pt-5">
      <div>
        <p className="eyebrow">Health and safety</p>
        <h1 className="mt-1 text-3xl text-ink">Training</h1>
      </div>

      <div className={cn("rounded-2xl p-5", summary.compliant ? "bg-green-tint-soft ring-1 ring-green/40" : "bg-card ring-1 ring-border")}>
        <p className="font-display font-bold text-3xl text-ink tabular">
          {currentCount} <span className="text-xl text-muted-foreground">of {required.length}</span>
        </p>
        <p className="mt-1 font-semibold text-ink">modules current</p>
        <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${currentCount} of ${required.length} modules current`}>
          {required.map((s) => (
            <span
              key={s.module.id}
              className={cn(
                "flex-1 border-r-2 border-card last:border-r-0",
                s.status === "COMPLETE" && "bg-status-good",
                s.status === "DUE_SOON" && "bg-status-warn",
                s.status === "OVERDUE" && "bg-status-bad",
                s.status === "NOT_STARTED" && "bg-transparent",
              )}
            />
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-soft">
          {summary.compliant
            ? summary.dueSoon > 0
              ? `You can book any shift. ${summary.dueSoon} refresher${summary.dueSoon === 1 ? " is" : "s are"} due within 30 days.`
              : "All current. You can book any shift for your roles."
            : summary.overdue > 0
              ? "Overdue modules block new bookings for the shifts that need them. Your regular slot keeps running."
              : "Complete the modules below before your first shift."}
        </p>
      </div>

      <ul className="flex flex-col gap-2.5">
        {required.map((s) => {
          const online = s.module.delivery === "ONLINE_CONFIRM";
          const actionable = s.status !== "COMPLETE";
          const Inner = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-ink">{s.module.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {s.module.validityMonths ? `Valid ${s.module.validityMonths} months` : "Once only"} · {DELIVERY_LABEL[s.module.delivery]}
                  </p>
                </div>
                <TrainingChip status={s.status} size="sm" className="shrink-0" />
              </div>
              <p className="mt-2 text-sm text-ink-soft tabular">
                {s.status === "NOT_STARTED" && (s.module.mandatoryBeforeFirstShift ? "Required before your first shift." : "Not yet completed.")}
                {s.status === "COMPLETE" && s.expiresISO && `Completed ${formatDate(s.completedISO!)} · expires ${formatDate(s.expiresISO)}`}
                {s.status === "COMPLETE" && !s.expiresISO && `Completed ${formatDate(s.completedISO!)} · does not expire`}
                {s.status === "DUE_SOON" && `Expires ${formatDate(s.expiresISO!)} (${relativeDays(s.expiresISO!, today)})`}
                {s.status === "OVERDUE" && `Expired ${formatDate(s.expiresISO!)} (${relativeDays(s.expiresISO!, today)})`}
              </p>
              {actionable && (
                <p className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-green-text">
                  {online ? <BookOpen className="size-4" aria-hidden /> : <CalendarDays className="size-4" aria-hidden />}
                  {online ? "Read and confirm online" : "Book a session below"}
                  <ChevronRight className="size-4" aria-hidden />
                </p>
              )}
            </>
          );
          return (
            <li key={s.module.id}>
              {actionable ? (
                <Link href={online ? `/app/training/${s.module.code}` : "#sessions"} className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-green">
                  {Inner}
                </Link>
              ) : (
                <div className="rounded-2xl border border-border bg-card p-4">{Inner}</div>
              )}
            </li>
          );
        })}
      </ul>

      <section id="sessions" aria-labelledby="sessions-heading" className="scroll-mt-4">
        <h2 id="sessions-heading" className="mb-2 text-xl text-ink">Upcoming sessions</h2>
        {relevantSessions.length === 0 && otherSessions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">No sessions scheduled right now.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {[...relevantSessions, ...otherSessions].map((s) => {
              const mine = s.rsvps.find((r) => r.volunteerId === me.id)?.status ?? null;
              const going = s.rsvps.filter((r) => r.status === "GOING").length;
              const relevant = relevantSessions.includes(s);
              return (
                <li key={s.id} className={cn("rounded-2xl border bg-card p-4 shadow-sm", relevant ? "border-green/50" : "border-border")}>
                  <p className="font-bold text-ink">{s.module.name}</p>
                  <p className="mt-0.5 text-sm text-ink-soft tabular">{formatInstant(s.startsAt)} to {formatInstantTime(s.endsAt)}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><MapPin className="size-4" aria-hidden />{s.location}</span>
                    <span className="inline-flex items-center gap-1 tabular"><Users className="size-4" aria-hidden />{going} of {s.capacity} booked</span>
                  </p>
                  {!relevant && <p className="mt-2 text-sm text-muted-foreground">Your record for this module is current; come along if you would like a refresher.</p>}
                  <div className="mt-3">
                    <SessionRsvp sessionId={s.id} status={mine} full={going >= s.capacity && mine !== "GOING"} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {notRequired.length > 0 && (
        <section aria-labelledby="nr-heading">
          <h2 id="nr-heading" className="mb-2 text-base font-bold text-muted-foreground">Not required for your roles</h2>
          <ul className="flex flex-col gap-1.5">
            {notRequired.map((s) => (
              <li key={s.module.id} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground">
                <span>{s.module.name}</span>
                <TrainingChip status="NOT_REQUIRED" size="sm" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
