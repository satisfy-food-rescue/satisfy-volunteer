import Link from "next/link";
import { Suspense } from "react";
import { Sprout, Zap } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { todayISO, WEEKDAY_SHORT } from "@/lib/dates";
import { ROLE_SHORT, fullName, inHarvestPool, isVolunteerRole } from "@/lib/domain";
import { moduleStatuses, trainingSummary } from "@/lib/training";
import { PageHeader } from "@/components/shared/page-header";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { TrainingChip } from "@/components/shared/status-chip";
import { VolunteerFilters } from "@/components/admin/volunteer-filters";
import { AddVolunteerButton } from "@/components/admin/volunteer-admin-controls";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const metadata = { title: "Volunteers" };

export default async function VolunteersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = todayISO();
  const [volunteers, modules] = await Promise.all([
    // Deleted accounts are left out: there is nothing to see or do, and they
    // are still reachable from the roster history they appear on.
    db.volunteer.findMany({ where: { role: "VOLUNTEER", status: { not: "DELETED" } }, include: { trainingRecords: true, regularSlots: { include: { template: true } } }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    db.trainingModule.findMany(),
  ]);
  const q = (sp.q ?? "").toLowerCase().trim();
  const rows = volunteers
    .map((v) => ({ v, summary: trainingSummary(moduleStatuses(v, modules, v.trainingRecords, today)) }))
    .filter(({ v, summary }) => {
      if (q && !`${fullName(v)} ${v.suburb ?? ""} ${v.email}`.toLowerCase().includes(q)) return false;
      if (sp.type === "regular" && !v.isRegular) return false;
      if (sp.type === "harvest" && !inHarvestPool(v)) return false;
      if (sp.type === "casual" && (v.isRegular || inHarvestPool(v))) return false;
      if (sp.role && (!isVolunteerRole(sp.role) || !v.roles.includes(sp.role))) return false;
      if (sp.training === "COMPLETE" && !summary.compliant) return false;
      if (sp.training && sp.training !== "COMPLETE" && summary.worst !== sp.training && !(sp.training === "DUE_SOON" && summary.dueSoon > 0 && summary.compliant)) return false;
      return true;
    });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <PageHeader eyebrow="People" title="Volunteers" description={`${volunteers.filter((x) => x.status === "ACTIVE").length} active volunteers. ${volunteers.filter((x) => x.isRegular).length} hold a regular slot, ${volunteers.filter((x) => inHarvestPool(x)).length} are in the harvest pool.`} actions={<AddVolunteerButton />} />
      <Suspense><VolunteerFilters /></Suspense>
      <div className="flex flex-col gap-2">
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="font-display bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-bold">Name</th>
                <th scope="col" className="hidden px-4 py-2.5 font-bold @2xl/admin:table-cell">Roles</th>
                <th scope="col" className="hidden px-4 py-2.5 font-bold @4xl/admin:table-cell">Regular slot</th>
                <th scope="col" className="px-4 py-2.5 font-bold">Training</th>
                <th scope="col" className="hidden px-4 py-2.5 text-right font-bold @xl/admin:table-cell">Flags</th>
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
                        <span className="block text-xs text-muted-foreground">{[v.suburb, v.birthYear && `aged ${new Date().getFullYear() - v.birthYear}`, v.status !== "ACTIVE" && "inactive"].filter(Boolean).join(" · ")}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="hidden px-4 py-2.5 text-ink-soft @2xl/admin:table-cell">{v.roles.map((r) => ROLE_SHORT[r]).join(", ")}</td>
                  <td className="hidden px-4 py-2.5 text-ink-soft @4xl/admin:table-cell">
                    {v.regularSlots.length === 0 ? <span className="text-muted-foreground">None</span> : v.regularSlots.map((s) => `${WEEKDAY_SHORT[s.weekday]} ${s.template.kind === "WAREHOUSE" ? "warehouse" : s.template.name.split(": ")[1]}`).join(", ")}
                  </td>
                  <td className="px-4 py-2.5"><TrainingChip status={summary.worst} size="sm" /></td>
                  <td className="hidden px-4 py-2.5 text-right @xl/admin:table-cell">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      {inHarvestPool(v) && <Flag icon={<Sprout className="size-4" aria-hidden />} label="Harvest pool" />}
                      {v.lastMinuteOk && <Flag icon={<Zap className="size-4" aria-hidden />} label="Last-minute available" />}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hidden flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground @xl/admin:flex" aria-hidden>
          <span className="inline-flex items-center gap-1.5"><Sprout className="size-3.5" /> Harvest pool</span>
          <span className="inline-flex items-center gap-1.5"><Zap className="size-3.5" /> Last-minute available</span>
        </p>
      </div>
    </div>
  );
}

/** A flag icon, named for screen readers and shown in a tooltip on hover. */
function Flag({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex size-7 items-center justify-center rounded-md hover:bg-muted hover:text-ink" />}>
        {icon}
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
