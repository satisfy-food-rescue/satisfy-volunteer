import Link from "next/link";
import { ExternalLink, FileSignature, UserCheck } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { ACTIVE_POOL } from "@/lib/pool";
import { formatDate, todayISO } from "@/lib/dates";
import { MOJ_CHECK_URL, MOJ_RENEWAL_DAYS, ROLE_SHORT, fullName } from "@/lib/domain";
import { getSettings } from "@/lib/settings";
import { inductionsFor, currentAgreements } from "@/lib/induction-data";
import { MOJ_STATUS_LABEL, type Induction, type MojStatus } from "@/lib/induction";
import { PageHeader } from "@/components/shared/page-header";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { Chip } from "@/components/shared/status-chip";
import { MojRolesForm, RecordMojCheckButton } from "@/components/admin/induction-controls";
import { cn } from "@/lib/utils";

export const metadata = { title: "Induction" };

const FILTERS = [
  { value: "todo", label: "Needs something" },
  { value: "NEEDED", label: "No check yet" },
  { value: "RENEWAL_DUE", label: "Renewal due" },
  { value: "EXPIRED", label: "Expired" },
  { value: "unsigned", label: "Agreements to sign" },
  { value: "all", label: "Everyone" },
] as const;

const MOJ_TONE: Record<MojStatus, "good" | "warn" | "bad" | "info" | "muted"> = { CURRENT: "good", RENEWAL_DUE: "warn", EXPIRED: "bad", NEEDED: "info", NOT_REQUIRED: "muted" };

function matches(filter: string, i: Induction) {
  const unsigned = i.agreements.some((a) => a.status === "UNSIGNED" || a.status === "UPDATED");
  if (filter === "all") return true;
  if (filter === "unsigned") return unsigned;
  if (filter === "todo") return !i.complete || i.moj.status === "RENEWAL_DUE";
  return i.moj.status === filter;
}

export default async function InductionAdminPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin();
  const { show } = await searchParams;
  const filter = FILTERS.some((f) => f.value === show) ? show! : "todo";
  const today = todayISO();
  const [settings, volunteers, agreements] = await Promise.all([
    getSettings(),
    db.volunteer.findMany({ where: ACTIVE_POOL, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    currentAgreements(),
  ]);
  const inductions = await inductionsFor(volunteers, today);
  const rows = volunteers.map((v) => ({ v, i: inductions.get(v.id)! }));
  const shown = rows.filter((r) => matches(filter, r.i));
  const count = (f: string) => rows.filter((r) => matches(f, r.i)).length;
  const mojOn = settings.mojCheckRoles.length > 0;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <PageHeader
        eyebrow="People"
        title="Induction"
        description="What volunteers need before training or shifts: a current Ministry of Justice check for the roles that need one, and the agreements for their roles, signed in the app."
      />

      <div className="grid gap-4 @4xl/admin:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5" aria-labelledby="moj-h">
          <div className="flex items-center gap-2">
            <UserCheck className="size-5 text-teal" aria-hidden />
            <h2 id="moj-h" className="text-xl text-ink">Ministry of Justice check</h2>
          </div>
          <p className="text-sm text-ink-soft">
            Volunteers request their own check online and send it to you. Record the date on it from their row below or their profile. It renews every three years: they and you are emailed {MOJ_RENEWAL_DAYS} days before, and again if it runs out.{" "}
            <a href={MOJ_CHECK_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-teal hover:underline">What volunteers see <ExternalLink className="size-3.5" aria-hidden /></a>
          </p>
          <MojRolesForm initial={settings.mojCheckRoles} />
          {!mojOn && <p className="text-sm text-muted-foreground">Off: no role needs a check yet. Record the checks you already hold, then turn it on for the roles that need one.</p>}
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5" aria-labelledby="agr-h">
          <div className="flex items-center gap-2">
            <FileSignature className="size-5 text-teal" aria-hidden />
            <h2 id="agr-h" className="text-xl text-ink">Agreements</h2>
          </div>
          <p className="text-sm text-ink-soft">Volunteers tick to sign these on their induction page, before training. A new version asks everyone to sign again.</p>
          {agreements.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet. Add the volunteer and confidentiality agreements from Policies.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {agreements.map((a) => {
                const required = rows.filter((r) => r.i.agreements.some((x) => x.document.id === a.id && x.required));
                const signed = required.filter((r) => r.i.agreements.some((x) => x.document.id === a.id && x.status === "SIGNED")).length;
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{a.title}</span>
                      <span className="block text-xs text-muted-foreground">Version {a.version} · {a.roles.map((r) => ROLE_SHORT[r]).join(", ")}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-ink-soft tabular">{signed} of {required.length} signed</span>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/admin/policies" className="self-start text-sm font-semibold text-teal hover:underline">Manage policies and agreements</Link>
        </section>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="people-h">
        <h2 id="people-h" className="text-2xl text-ink">Volunteers</h2>
        <nav aria-label="Show" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={f.value === "todo" ? "/admin/induction" : `/admin/induction?show=${f.value}`}
              scroll={false}
              aria-current={filter === f.value ? "page" : undefined}
              className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 font-display text-sm font-semibold transition-colors", filter === f.value ? "border-teal bg-teal text-white" : "border-border bg-card text-ink-soft hover:border-teal/60 hover:text-ink")}
            >
              {f.label}
              <span className={cn("tabular", filter === f.value ? "text-white/80" : "text-muted-foreground")}>{count(f.value)}</span>
            </Link>
          ))}
        </nav>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="font-display bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-bold">Volunteer</th>
                <th scope="col" className="px-4 py-2.5 font-bold">MOJ check</th>
                <th scope="col" className="hidden px-4 py-2.5 font-bold @2xl/admin:table-cell">Agreements</th>
                <th scope="col" className="px-4 py-2.5 text-right font-bold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">{filter === "todo" ? "Everyone's induction is in order. Ka pai." : "Nobody matches."}</td></tr>
              )}
              {shown.map(({ v, i }) => {
                const required = i.agreements.filter((a) => a.required);
                const signed = required.filter((a) => a.status === "SIGNED").length;
                return (
                  <tr key={v.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/volunteers/${v.id}`} className="flex items-center gap-2 font-bold text-ink hover:underline">
                        <AvatarBadge person={v} size="sm" className="size-7 text-[0.6875rem]" />
                        {fullName(v)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Chip tone={MOJ_TONE[i.moj.status]} size="sm">{i.moj.status !== "NOT_REQUIRED" ? MOJ_STATUS_LABEL[i.moj.status] : !mojOn ? (i.moj.checkedISO ? "Ran out" : "Not recorded") : "Not needed"}</Chip>
                      {i.moj.renewsISO && <span className={cn("mt-0.5 block text-xs tabular", i.moj.status === "EXPIRED" ? "text-status-bad" : i.moj.status === "RENEWAL_DUE" ? "text-status-warn" : "text-muted-foreground")}>{i.moj.status === "EXPIRED" ? "Ran out" : "Renews"} {formatDate(i.moj.renewsISO)}</span>}
                    </td>
                    <td className="hidden px-4 py-2.5 @2xl/admin:table-cell">
                      {required.length === 0 ? (
                        <span className="text-muted-foreground">None needed</span>
                      ) : (
                        <span className={cn("font-semibold tabular", signed === required.length ? "text-status-good" : "text-ink-soft")}>
                          {signed} of {required.length} signed
                          {i.agreements.some((a) => a.status === "UPDATED") && <span className="block text-xs font-normal text-status-warn">New version to sign</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {i.moj.status !== "CURRENT" && (mojOn ? i.moj.status !== "NOT_REQUIRED" : true) && <RecordMojCheckButton volunteer={{ id: v.id, firstName: v.firstName }} today={today} renewing={i.moj.checkedISO !== null} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
