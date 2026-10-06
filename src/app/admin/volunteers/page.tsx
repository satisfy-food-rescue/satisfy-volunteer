import Link from "next/link";
import { Suspense } from "react";
import { Sprout, Zap } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { todayISO, WEEKDAY_SHORT } from "@/lib/dates";
import { ROLE_SHORT, fullName } from "@/lib/domain";
import { moduleStatuses, trainingSummary } from "@/lib/training";
import { PageHeader } from "@/components/shared/page-header";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { TrainingChip } from "@/components/shared/status-chip";
import { VolunteerFilters } from "@/components/admin/volunteer-filters";
import { AddVolunteerButton } from "@/components/admin/volunteer-admin-controls";

export const metadata = { title: "Volunteers" };

export default async function VolunteersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = todayISO();
  const [volunteers, modules] = await Promise.all([
    db.volunteer.findMany({ where: { role: "VOLUNTEER" }, include: { trainingRecords: true, regularSlots: { include: { template: true } } }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    db.trainingModule.findMany(),
  ]);
  const q = (sp.q ?? "").toLowerCase().trim();
  const rows = volunteers
    .map((v) => ({ v, summary: trainingSummary(moduleStatuses(v, modules, v.trainingRecords, today)) }))
    .filter(({ v, summary }) => {
      if (q && !`${fullName(v)} ${v.suburb ?? ""} ${v.email}`.toLowerCase().includes(q)) return false;
      if (sp.type === "regular" && !v.isRegular) return false;
      if (sp.type === "harvest" && !v.inHarvestPool) return false;
      if (sp.type === "casual" && (v.isRegular || v.inHarvestPool)) return false;
      if (sp.role && !v.roles.includes(sp.role as never)) return false;
      if (sp.training === "COMPLETE" && !summary.compliant) return false;
      if (sp.training && sp.training !== "COMPLETE" && summary.worst !== sp.training && !(sp.training === "DUE_SOON" && summary.dueSoon > 0 && summary.compliant)) return false;
      return true;
    });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader eyebrow="People" title="Volunteers" description={`${volunteers.filter((x) => x.status === "ACTIVE").length} active volunteers. ${volunteers.filter((x) => x.isRegular).length} hold a regular slot, ${volunteers.filter((x) => x.inHarvestPool).length} are in the harvest pool.`} actions={<AddVolunteerButton />} />
      <Suspense><VolunteerFilters /></Suspense>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="font-display bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-bold">Name</th>
              <th className="hidden px-4 py-2.5 font-bold md:table-cell">Roles</th>
              <th className="hidden px-4 py-2.5 font-bold @4xl/admin:table-cell">Regular slot</th>
              <th className="px-4 py-2.5 font-bold">Training</th>
              <th className="hidden px-4 py-2.5 text-right font-bold sm:table-cell">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No volunteers match these filters.</td></tr>}
            {rows.map(({ v, summary }) => (
              <tr key={v.id} className="hover:bg-muted/40">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/volunteers/${v.id}`} className="flex items-center gap-3">
                    <AvatarBadge person={v} size="sm" />
                    <span className="min-w-0">
                      <span className="block font-bold text-ink hover:underline">{fullName(v)}</span>
                      <span className="block text-xs text-muted-foreground">{v.suburb}{v.birthYear ? ` · ${new Date().getFullYear() - v.birthYear}` : ""}{v.status !== "ACTIVE" ? " · inactive" : ""}</span>
                    </span>
                  </Link>
                </td>
                <td className="hidden px-4 py-2.5 text-ink-soft md:table-cell">{v.roles.map((r) => ROLE_SHORT[r]).join(", ")}</td>
                <td className="hidden px-4 py-2.5 text-ink-soft @4xl/admin:table-cell">
                  {v.regularSlots.length === 0 ? <span className="text-muted-foreground">None</span> : v.regularSlots.map((s) => `${WEEKDAY_SHORT[s.weekday]} ${s.template.kind === "WAREHOUSE" ? "warehouse" : s.template.name.split(": ")[1]}`).join(", ")}
                </td>
                <td className="px-4 py-2.5"><TrainingChip status={summary.worst} size="sm" /></td>
                <td className="hidden px-4 py-2.5 text-right sm:table-cell">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    {v.inHarvestPool && <Sprout className="size-4" aria-label="Harvest pool" />}
                    {v.lastMinuteOk && <Zap className="size-4" aria-label="Last-minute available" />}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
