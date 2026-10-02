import { Apple, MapPin, Sprout, Users } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { db } from "@/lib/db";
import { dateToISO, formatDayLong, formatTimeRange, isoToDate, todayISO } from "@/lib/dates";
import { HarvestPoolToggle, HarvestRsvp } from "@/components/app/harvest-controls";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { cn } from "@/lib/utils";

export const metadata = { title: "Harvest pool" };

export default async function HarvestPage() {
  const me = await requireVolunteer();
  const today = todayISO();
  const [callouts, poolCount] = await Promise.all([
    db.harvestCallout.findMany({ where: { date: { gte: isoToDate(today) } }, include: { rsvps: { include: { volunteer: true } } }, orderBy: { date: "asc" } }),
    db.volunteer.count({ where: { inHarvestPool: true, status: "ACTIVE" } }),
  ]);

  return (
    <div className="flex flex-col gap-6 px-5 pb-6 pt-5">
      <div>
        <p className="eyebrow">Seasonal</p>
        <h1 className="mt-1 text-3xl text-ink">Harvest pool</h1>
      </div>

      <section className={cn("rounded-2xl p-5", me.inHarvestPool ? "bg-green-tint-soft ring-1 ring-green/40" : "bg-card ring-1 ring-border")}>
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-green-text ring-1 ring-green/30">
            <Sprout className="size-6" aria-hidden />
          </span>
          <div>
            <p className="font-bold text-ink">{me.inHarvestPool ? "You're in the pool" : "Join the harvest pool"}</p>
            <p className="mt-1 text-sm text-ink-soft">
              In summer and autumn we pick fruit from orchards and backyard trees with Food Secure North Canterbury. Pool members get a callout with the details and reply in the app. {poolCount} volunteers are in the pool.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <HarvestPoolToggle inPool={me.inHarvestPool} />
        </div>
      </section>

      <section aria-labelledby="callouts">
        <h2 id="callouts" className="mb-2 text-xl text-ink">Callouts</h2>
        {callouts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">No harvests planned right now. We will send a callout when the fruit is ready.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {callouts.map((c) => {
              const iso = dateToISO(c.date);
              const going = c.rsvps.filter((r) => r.status === "GOING");
              const mine = c.rsvps.find((r) => r.volunteerId === me.id)?.status ?? null;
              return (
                <li key={c.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div className="flex items-center gap-3 bg-green-deep px-4 py-3 text-white">
                    <Apple className="size-6 text-green" aria-hidden />
                    <div>
                      <p className="font-bold">{c.title}</p>
                      <p className="text-sm text-white/80 tabular">{formatDayLong(iso)}, {formatTimeRange(c.startTime, c.endTime)}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 p-4">
                    <p className="inline-flex items-start gap-1.5 text-sm text-ink-soft"><MapPin className="mt-0.5 size-4 shrink-0 text-green-text" aria-hidden />{c.location} · with {c.partner}</p>
                    <p className="text-ink">{c.description}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="size-4" aria-hidden />
                      <span className="tabular">{going.length} of {c.needed} pickers so far</span>
                      <span className="flex -space-x-1">
                        {going.slice(0, 5).map((r) => <AvatarBadge key={r.id} person={r.volunteer} size="sm" className="ring-2 ring-card" />)}
                      </span>
                    </div>
                    {me.inHarvestPool ? (
                      <HarvestRsvp calloutId={c.id} status={mine} />
                    ) : (
                      <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Join the pool above to respond to this callout.</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
