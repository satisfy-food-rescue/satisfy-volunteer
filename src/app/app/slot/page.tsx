import { CalendarCheck, CalendarOff } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { formatDay, formatTimeRange, todayISO, dateToISO, WEEKDAY_LONG } from "@/lib/dates";
import { myAbsences, myRegularSlots, myUpcomingShifts } from "@/lib/volunteer-data";
import { ABSENCE_REASON_LABEL } from "@/lib/domain";
import { MarkAwayForm } from "@/components/app/mark-away-form";
import { RemoveAbsenceButton } from "@/components/app/remove-absence-button";
import { AppPage, AppPageHeader } from "@/components/app/app-page-header";
import { Chip } from "@/components/shared/status-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata = { title: "My regular slot" };

export default async function SlotPage() {
  const me = await requireVolunteer();
  const today = todayISO();
  const [slots, absences, upcoming] = await Promise.all([
    myRegularSlots(me.id),
    myAbsences(me.id, today),
    myUpcomingShifts(me.id, today, 90),
  ]);

  return (
    <AppPage className="pt-3">
      <AppPageHeader back={{ href: "/app/profile", label: "Me", tabBarOnly: true }} eyebrow="Recurring commitment" title="My regular slot" />

      {/* With room, the form to mark yourself away stays beside your slot and
          the absences it has made. On a phone it sits between them. */}
      <div className="flex flex-col gap-6 @4xl/app:grid @4xl/app:grid-cols-12 @4xl/app:items-start @4xl/app:gap-8">
        <div className="contents @4xl/app:col-span-7 @4xl/app:flex @4xl/app:flex-col @4xl/app:gap-8">
          {slots.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="No regular slot yet"
              description="Most volunteers hold a weekly slot. Once your training is done, talk to the coordinator or book a few one-off shifts to find a morning that suits."
              action={<Button variant="outline" className="h-11" render={<Link href="/app/shifts" />}>Browse shifts</Button>}
            />
          ) : (
            <ul className="grid gap-2.5 @3xl/app:grid-cols-2 @3xl/app:gap-3 @4xl/app:grid-cols-1 @6xl/app:grid-cols-2">
              {slots.map((s) => (
                <li key={s.id} className="flex items-center gap-4 rounded-2xl border border-teal/25 bg-teal-tint-soft p-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-card text-teal">
                    <CalendarCheck className="size-6" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display font-bold text-xl text-ink">{WEEKDAY_LONG[s.weekday]}s</span>
                    <span className="block text-ink">{s.template.name}</span>
                    <span className="block text-sm text-ink-soft tabular">{formatTimeRange(s.template.startTime, s.template.endTime)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <section aria-labelledby="absences-heading" className="order-3 @4xl/app:order-none">
            <h2 id="absences-heading" className="mb-2 text-xl text-ink">Upcoming absences</h2>
            {absences.length === 0 ? (
              <EmptyState icon={CalendarOff} title="None planned" description="Ka pai." className="py-6" />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {absences.map((a) => {
                  const s = dateToISO(a.startDate);
                  const e = dateToISO(a.endDate);
                  const released = a.releasedAssignments.filter((r) => r.status === "RELEASED");
                  return (
                    <li key={a.id} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 break-words">
                          <p className="font-bold text-ink">{s === e ? formatDay(s) : `${formatDay(s)} to ${formatDay(e)}`}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <Chip tone="neutral" size="sm">{ABSENCE_REASON_LABEL[a.reason]}</Chip>
                            {a.note && <span>{a.note}</span>}
                          </p>
                          <p className="mt-2 text-sm text-ink-soft">
                            {released.length === 0 ? "No regular shifts affected." : `${released.length} ${released.length === 1 ? "shift" : "shifts"} released for cover.`}
                          </p>
                        </div>
                        {s >= today && (
                          <RemoveAbsenceButton absenceId={a.id} />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <section aria-labelledby="away-heading" className="order-2 rounded-2xl border border-border bg-card p-5 @4xl/app:sticky @4xl/app:top-8 @4xl/app:order-none @4xl/app:col-span-5 @4xl/app:rounded-3xl @4xl/app:p-6">
          <h2 id="away-heading" className="text-xl text-ink">Mark me away</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Holiday or sick? Tell us the dates and your shifts are released so someone else can cover. Your slot picks up again when you are back.
          </p>
          <MarkAwayForm today={today} upcoming={upcoming.map((u) => ({ iso: u.iso, name: u.name }))} />
        </section>
      </div>
    </AppPage>
  );
}
