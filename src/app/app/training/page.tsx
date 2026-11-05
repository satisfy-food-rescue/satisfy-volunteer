import Link from "next/link";
import { BookOpen, CalendarDays, ChevronRight, ClipboardCheck, Hammer, Lock, MapPin, Users } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { formatDate, formatInstantRange, relativeDays, todayISO } from "@/lib/dates";
import { trainingContext } from "@/lib/volunteer-data";
import { DELIVERY_LABEL } from "@/lib/domain";
import { Chip, TrainingChip } from "@/components/shared/status-chip";
import { inductionToDo, trainingLockOf } from "@/lib/induction";
import { SessionRsvp } from "@/components/app/session-rsvp";
import { EmptyState } from "@/components/shared/empty-state";
import { AppPage, AppPageHeader } from "@/components/app/app-page-header";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const metadata = { title: "Training" };

export default async function TrainingPage() {
  const me = await requireVolunteer();
  const today = todayISO();
  const [{ statuses, summary, induction }, sessions] = await Promise.all([
    trainingContext(me, today),
    db.trainingSession.findMany({
      where: { startsAt: { gte: new Date() } },
      include: { module: true, rsvps: true },
      orderBy: { startsAt: "asc" },
    }),
  ]);
  const required = statuses.filter((s) => s.required);
  // In development: shown as coming soon to the people it will be for.
  const comingSoon = statuses.filter((s) => s.module.inDevelopment && s.module.requiredRoles.some((r) => me.roles.includes(r)));
  const notRequired = statuses.filter((s) => !s.required && !s.module.inDevelopment);
  const locks = new Map(statuses.map((s) => [s.module.id, trainingLockOf(me, s, induction)]));
  const currentCount = required.filter((s) => s.status === "COMPLETE" || s.status === "DUE_SOON").length;
  const relevantSessions = sessions.filter((s) => {
    const st = statuses.find((x) => x.module.id === s.moduleId);
    return st?.required && st.status !== "COMPLETE";
  });
  const otherSessions = sessions.filter((s) => !relevantSessions.includes(s));

  return (
    <AppPage>
      <AppPageHeader eyebrow="Health and safety" title="Training" />

      {!induction.complete && (
        <Link href="/app/induction" className="group flex items-start gap-3 rounded-2xl bg-status-info-bg p-4 ring-1 ring-status-info/30 transition-colors hover:ring-status-info/60 @3xl/app:p-5">
          <ClipboardCheck className="mt-0.5 size-6 shrink-0 text-status-info" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-ink">Start with your induction</span>
            <span className="block text-sm text-ink-soft">Training opens once we have {inductionToDo(induction)}.</span>
          </span>
          <ChevronRight className="mt-0.5 size-5 shrink-0 text-status-info transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}

      {/* One column on a phone. With room, the summary holds still on the
          left while the modules and sessions run down the right. */}
      <div className="flex flex-col gap-6 @4xl/app:grid @4xl/app:grid-cols-12 @4xl/app:items-start @4xl/app:gap-8">
        <div className="contents @4xl/app:sticky @4xl/app:top-8 @4xl/app:col-span-5 @4xl/app:flex @4xl/app:flex-col @4xl/app:gap-6 @6xl/app:col-span-4">
          <div className={cn("rounded-2xl p-5 @4xl/app:rounded-3xl @4xl/app:p-6", summary.compliant ? "bg-green-tint-soft ring-1 ring-green/40" : "bg-card ring-1 ring-border")}>
            <p className="font-display font-bold text-3xl text-ink tabular @4xl/app:text-6xl">
              {currentCount} <span className="text-xl text-muted-foreground @4xl/app:text-3xl">of {required.length}</span>
            </p>
            <p className="mt-1 font-semibold text-ink">modules current</p>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted @4xl/app:mt-5 @4xl/app:h-3" role="img" aria-label={`${currentCount} of ${required.length} modules current`}>
              {required.map((s) => (
                <span
                  key={s.module.id}
                  className={cn(
                    "flex-1 border-r-2 border-card last:border-r-0",
                    s.status === "COMPLETE" && "bg-green",
                    s.status === "DUE_SOON" && "bg-orange",
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

          {comingSoon.length > 0 && (
            <section aria-labelledby="soon-heading" className="order-last @4xl/app:order-none">
              <h2 id="soon-heading" className="mb-2 text-base font-bold text-muted-foreground">Coming soon</h2>
              <ul className="flex flex-col gap-1.5">
                {comingSoon.map((s) => (
                  <li key={s.module.id} className="flex items-start justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{s.module.name}</span>
                      <span className="block text-muted-foreground">{s.module.description}</span>
                    </span>
                    <Chip tone="neutral" size="sm" icon={Hammer} className="shrink-0">In development</Chip>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {notRequired.length > 0 && (
            <section aria-labelledby="nr-heading" className="order-last @4xl/app:order-none">
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

        <div className="contents @4xl/app:col-span-7 @4xl/app:flex @4xl/app:flex-col @4xl/app:gap-8 @6xl/app:col-span-8">
          <ul className="grid gap-2.5 @6xl/app:grid-cols-2 @6xl/app:gap-3">
            {required.map((s) => {
              const online = s.module.delivery === "ONLINE_CONFIRM";
              const lock = locks.get(s.module.id) ?? null;
              const actionable = s.status !== "COMPLETE" && !lock;
              const Inner = (
                <>
                  {/* The chip shares a row with the title only, so the lines
                      below keep the card's full width. */}
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-bold text-ink">{s.module.name}</p>
                    <TrainingChip status={s.status} size="sm" className="shrink-0" />
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {s.module.validityMonths ? `Valid ${s.module.validityMonths} months` : "Once only"} · {DELIVERY_LABEL[s.module.delivery]}
                  </p>
                  <p className="mt-2 text-sm text-ink-soft tabular">
                    {s.status === "NOT_STARTED" && (s.module.mandatoryBeforeFirstShift ? "Required before your first shift." : "Not yet completed.")}
                    {/* Each half keeps its date whole when the line wraps. */}
                    {s.status === "COMPLETE" && (
                      <>
                        <span className="whitespace-nowrap">Completed {formatDate(s.completedISO!)}</span> ·{" "}
                        <span className="whitespace-nowrap">{s.expiresISO ? `expires ${formatDate(s.expiresISO)}` : "does not expire"}</span>
                      </>
                    )}
                    {s.status === "DUE_SOON" && `Expires ${formatDate(s.expiresISO!)} (${relativeDays(s.expiresISO!, today)})`}
                    {s.status === "OVERDUE" && `Expired ${formatDate(s.expiresISO!)} (${relativeDays(s.expiresISO!, today)})`}
                  </p>
                  {lock && s.status !== "COMPLETE" && (
                    <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
                      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {lock.kind === "after" && s.lockedBy ? `Opens once ${s.lockedBy.name} is done.` : "Opens once your induction is done."}
                    </p>
                  )}
                  {actionable && (
                    <p className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-teal group-hover:underline">
                      {online ? <BookOpen className="size-4" aria-hidden /> : <CalendarDays className="size-4" aria-hidden />}
                      {online ? "Complete it online" : "Book a session below"}
                      <ChevronRight className="size-4" aria-hidden />
                    </p>
                  )}
                </>
              );
              return (
                <li key={s.module.id}>
                  {actionable ? (
                    <Link href={online ? `/app/training/${s.module.code}` : "#sessions"} className="group block h-full rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-teal/60">
                      {Inner}
                    </Link>
                  ) : (
                    <div className="h-full rounded-2xl border border-border bg-card p-4">{Inner}</div>
                  )}
                </li>
              );
            })}
          </ul>

          <section id="sessions" aria-labelledby="sessions-heading" className="scroll-mt-4">
            <h2 id="sessions-heading" className="mb-2 text-xl text-ink @3xl/app:mb-3 @3xl/app:text-2xl">Upcoming sessions</h2>
            {relevantSessions.length === 0 && otherSessions.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No sessions scheduled right now" description="New sessions show up here as soon as they are booked in." className="py-6" />
            ) : (
              <ul className="grid gap-2.5 @6xl/app:grid-cols-2 @6xl/app:gap-3">
                {[...relevantSessions, ...otherSessions].map((s) => {
                  const mine = s.rsvps.find((r) => r.volunteerId === me.id)?.status ?? null;
                  const going = s.rsvps.filter((r) => r.status === "GOING").length;
                  const relevant = relevantSessions.includes(s);
                  const lock = mine === "GOING" ? null : (locks.get(s.moduleId) ?? null);
                  return (
                    <li key={s.id} className={cn("flex flex-col rounded-2xl border bg-card p-4 shadow-sm", relevant ? "border-teal/50" : "border-border")}>
                      <p className="font-bold text-ink">{s.module.name}</p>
                      <p className="mt-0.5 text-sm text-ink-soft tabular">{formatInstantRange(s.startsAt, s.endsAt)}</p>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><MapPin className="size-4" aria-hidden />{s.location}</span>
                        <span className="inline-flex items-center gap-1 tabular"><Users className="size-4" aria-hidden />{going} of {s.capacity} booked</span>
                      </p>
                      {!relevant && <p className="mt-2 text-sm text-muted-foreground">Your record for this module is current; come along if you would like a refresher.</p>}
                      <div className="mt-3 @6xl/app:mt-auto @6xl/app:pt-3">
                        {lock ? (
                          <p className="flex items-start gap-1.5 text-sm text-muted-foreground"><Lock className="mt-0.5 size-4 shrink-0" aria-hidden />{lock.text}</p>
                        ) : (
                          <SessionRsvp sessionId={s.id} status={mine} full={going >= s.capacity && mine !== "GOING"} />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppPage>
  );
}
