import Link from "next/link";
import { CalendarDays, GraduationCap, Plus, Sprout } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { addDays, formatDay, isoToDate, todayISO } from "@/lib/dates";
import { HARVEST_ROLE, inHarvestPool } from "@/lib/domain";
import { decorateShift, shiftInclude } from "@/lib/roster";
import { moduleStatuses, trainingSummary } from "@/lib/training";
import { PageHeader } from "@/components/shared/page-header";
import { StatTile } from "@/components/admin/stat-tile";
import { ShiftRow } from "@/components/admin/shift-row";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Harvests" };

export default async function HarvestsAdminPage() {
  await requireAdmin();
  const today = todayISO();
  const [shifts, volunteers, modules] = await Promise.all([
    db.shift.findMany({
      where: { template: { kind: "HARVEST" }, date: { gte: isoToDate(addDays(today, -60)) } },
      include: shiftInclude,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    db.volunteer.findMany({ where: { status: "ACTIVE", role: "VOLUNTEER", roles: { has: HARVEST_ROLE } }, include: { trainingRecords: true } }),
    db.trainingModule.findMany({ orderBy: { order: "asc" } }),
  ]);
  const views = shifts.map(decorateShift);
  const upcoming = views.filter((v) => v.iso >= today);
  const past = views.filter((v) => v.iso < today).reverse();
  const pool = volunteers.filter(inHarvestPool);
  const harvestModules = modules.filter((m) => m.requiredRoles.includes(HARVEST_ROLE));
  // Ready to pick: every harvest module current. Other roles' training does
  // not count here, so only the harvest modules are checked.
  const ready = pool.filter((v) => trainingSummary(moduleStatuses(v, harvestModules, v.trainingRecords, today)).compliant).length;
  const drafts = upcoming.filter((v) => v.isDraft).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        eyebrow="Roster"
        title="Harvests"
        description="One-off picking days. Plan one as a draft while the details firm up, then publish it to email and notify the whole harvest pool with a Sign up button."
        actions={<Button size="lg" render={<Link href="/admin/harvests/new" />}><Plus className="size-4" /> Plan a harvest</Button>}
      />

      <div className="grid grid-cols-1 gap-4 @2xl/admin:grid-cols-3">
        <StatTile label="Harvest pool" value={pool.length} hint="Active volunteers who joined" icon={Sprout} href="/admin/volunteers?type=harvest" />
        <StatTile label="Trained to pick" value={ready} hint={`${pool.length - ready} still to finish harvest training`} icon={GraduationCap} href="/admin/training?tab=people" />
        <StatTile label="Upcoming harvests" value={upcoming.length - drafts} hint={drafts ? `Plus ${drafts} ${drafts === 1 ? "draft" : "drafts"}` : "No drafts waiting"} icon={CalendarDays} />
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="upcoming-h">
        <h2 id="upcoming-h" className="text-2xl text-ink">Coming up</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-muted-foreground">No harvests planned. When the fruit is ready, plan one and the pool hears about it straight away.</div>
        ) : (
          <div className="flex flex-col gap-2">{upcoming.map((v) => <ShiftRow key={v.shift.id} view={v} showDate={formatDay(v.iso)} />)}</div>
        )}
      </section>

      {past.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="past-h">
          <h2 id="past-h" className="text-2xl text-ink">Last 60 days</h2>
          <div className="flex flex-col gap-2">{past.map((v) => <ShiftRow key={v.shift.id} view={v} showDate={formatDay(v.iso)} />)}</div>
        </section>
      )}
    </div>
  );
}
