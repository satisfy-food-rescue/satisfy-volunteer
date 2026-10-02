import Link from "next/link";
import { ArrowRight, BellRing, Clock, Mail, MapPin, Users } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { formatInstant, formatInstantTime, todayISO, formatDate } from "@/lib/dates";
import { DELIVERY_LABEL, EMAIL_KIND_LABEL, ROLE_SHORT, fullName, parseRoles, type Delivery, type EmailKind } from "@/lib/domain";
import { moduleStatuses } from "@/lib/training";
import { REMINDER_RULES } from "@/lib/reminders";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrainingChip } from "@/components/shared/status-chip";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { ModuleEditor, NewSessionForm, RunRemindersButton } from "@/components/admin/training-admin-controls";
import { cn } from "@/lib/utils";

export const metadata = { title: "Training" };

export default async function TrainingAdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab } = await searchParams;
  const today = todayISO();
  const [modules, volunteers, sessions, reminderEmails] = await Promise.all([
    db.trainingModule.findMany({ orderBy: { order: "asc" } }),
    db.volunteer.findMany({ where: { status: "ACTIVE", role: "VOLUNTEER" }, include: { trainingRecords: true } }),
    db.trainingSession.findMany({ include: { module: true, rsvps: { include: { volunteer: true } } }, orderBy: { startsAt: "asc" } }),
    db.email.findMany({ where: { kind: { in: ["TRAINING_DUE_SOON", "TRAINING_OVERDUE"] } }, include: { volunteer: true }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const perVolunteer = volunteers.map((v) => ({ v, statuses: moduleStatuses(v, modules, v.trainingRecords, today) }));
  const moduleStats = modules.map((m) => {
    const rel = perVolunteer.map((x) => x.statuses.find((s) => s.module.id === m.id)!).filter((s) => s.required);
    const count = (st: string) => rel.filter((s) => s.status === st).length;
    return { m, required: rel.length, complete: count("COMPLETE"), dueSoon: count("DUE_SOON"), overdue: count("OVERDUE"), notStarted: count("NOT_STARTED") };
  });
  const attention = perVolunteer.flatMap((x) => x.statuses.filter((s) => s.status === "OVERDUE" || s.status === "DUE_SOON" || s.status === "NOT_STARTED").map((s) => ({ v: x.v, s })))
    .sort((a, b) => (a.s.daysLeft ?? 999) - (b.s.daysLeft ?? 999));
  const upcoming = sessions.filter((s) => s.startsAt >= new Date());
  const past = sessions.filter((s) => s.startsAt < new Date()).reverse();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader eyebrow="Training" title="Modules, sessions and reminders" description="Configure what each role must complete and how often. The gate in the volunteer app reads directly from these settings." />
      <Tabs defaultValue={tab === "sessions" || tab === "reminders" || tab === "people" ? tab : "modules"} className="gap-6">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto overflow-y-hidden scrollbar-none">
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="people">
            Needs attention
            <span className="rounded-full bg-status-bad-bg px-2 py-0.5 text-xs font-bold leading-none text-status-bad tabular">{attention.length}</span>
          </TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="flex flex-col gap-3">
          {moduleStats.map(({ m, required, complete, dueSoon, overdue, notStarted }) => (
            <article key={m.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl text-ink">{m.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
                    <span><span className="font-semibold text-ink">{m.validityMonths ? `Every ${m.validityMonths} months` : "Once"}</span></span>
                    <span>{DELIVERY_LABEL[m.delivery as Delivery]}</span>
                    <span>Required for {parseRoles(m.requiredRoles).map((r) => ROLE_SHORT[r].toLowerCase()).join(", ")}</span>
                    {m.mandatoryBeforeFirstShift && <span className="font-semibold text-green-text">Mandatory before first shift</span>}
                  </p>
                </div>
                <div className="w-full sm:w-64">
                  <p className="mb-1 flex justify-between text-xs font-semibold text-muted-foreground"><span>{required} volunteers</span><span className="tabular">{required ? Math.round(((complete + dueSoon) / required) * 100) : 100}% current</span></p>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${complete} complete, ${dueSoon} due soon, ${overdue} overdue, ${notStarted} not started`}>
                    {[["bg-status-good", complete], ["bg-status-warn", dueSoon], ["bg-status-bad", overdue]].map(([c, n]) => (n as number) > 0 && <span key={c as string} className={cn(c as string, "border-r-2 border-card last:border-r-0")} style={{ width: `${((n as number) / required) * 100}%` }} />)}
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular">
                    <span className="text-status-good">{complete} complete</span><span className="text-status-warn">{dueSoon} due soon</span><span className="text-status-bad">{overdue} overdue</span>{notStarted > 0 && <span>{notStarted} not started</span>}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <ModuleEditor module={{ id: m.id, name: m.name, validityMonths: m.validityMonths, requiredRoles: parseRoles(m.requiredRoles), mandatoryBeforeFirstShift: m.mandatoryBeforeFirstShift, delivery: m.delivery as "IN_PERSON" | "ONLINE_CONFIRM" }} />
              </div>
            </article>
          ))}
        </TabsContent>

        <TabsContent value="people">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="font-display bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-2.5 font-bold">Volunteer</th><th className="px-4 py-2.5 font-bold">Module</th><th className="hidden px-4 py-2.5 font-bold sm:table-cell">Expiry</th><th className="px-4 py-2.5 font-bold">Status</th></tr></thead>
              <tbody className="divide-y divide-border">
                {attention.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Everyone is current. Ka pai.</td></tr>}
                {attention.map(({ v, s }) => (
                  <tr key={v.id + s.module.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5"><Link href={`/admin/volunteers/${v.id}`} className="flex items-center gap-2 font-bold text-ink hover:underline"><AvatarBadge person={v} size="sm" className="size-7 text-[0.6rem]" />{fullName(v)}</Link></td>
                    <td className="px-4 py-2.5 text-ink-soft">{s.module.name}<span className="block text-xs text-muted-foreground">{DELIVERY_LABEL[s.module.delivery as Delivery]}</span></td>
                    <td className="hidden px-4 py-2.5 text-ink-soft tabular sm:table-cell">{s.expiresISO ? formatDate(s.expiresISO) : "Never completed"}</td>
                    <td className="px-4 py-2.5"><TrainingChip status={s.status} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="flex flex-col gap-4">
          <NewSessionForm today={today} modules={modules.filter((m) => m.delivery === "IN_PERSON" || true).map((m) => ({ id: m.id, name: m.name }))} />
          <h2 className="text-2xl text-ink">Upcoming</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((s) => <SessionCard key={s.id} s={s} />)}
            {upcoming.length === 0 && <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-muted-foreground md:col-span-2 xl:col-span-3">No sessions scheduled.</p>}
          </div>
          {past.length > 0 && (
            <>
              <h2 className="mt-2 text-2xl text-ink">Past</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{past.map((s) => <SessionCard key={s.id} s={s} />)}</div>
            </>
          )}
        </TabsContent>

        <TabsContent value="reminders" className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <section className="lg:col-span-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl text-ink">Reminder rules</h2>
                <RunRemindersButton />
              </div>
              <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {REMINDER_RULES.map((r, i) => (
                  <li key={r.id} className="flex gap-4 px-4 py-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-tint font-display font-bold text-green-deep">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{r.when}</p>
                      <p className="text-sm text-ink-soft">Sends <span className="font-semibold">{r.template}</span> to {r.audience.toLowerCase()}.</p>
                      <p className="text-sm text-muted-foreground">{r.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground"><BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />In production these run nightly. Nothing is sent from this demo; every email lands in the Outbox instead.</p>
            </section>
            <section className="lg:col-span-2">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-2xl text-ink">Recent reminders</h2>
                <Link href="/admin/outbox" className="text-sm font-semibold text-green-text hover:underline">Open Outbox</Link>
              </div>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {reminderEmails.map((e) => (
                  <li key={e.id}>
                    <Link href={`/admin/outbox/${e.id}`} className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted">
                      <Mail className={cn("mt-0.5 size-4 shrink-0", e.kind === "TRAINING_OVERDUE" ? "text-status-bad" : "text-status-warn")} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink">{e.subject}</span>
                        <span className="block text-xs text-muted-foreground">To {e.toName} · {EMAIL_KIND_LABEL[e.kind as EmailKind]} · {formatInstant(e.createdAt)}</span>
                      </span>
                      <ArrowRight className="mt-1 size-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SessionCard({ s }: { s: { id: string; startsAt: Date; endsAt: Date; location: string; capacity: number; module: { name: string }; rsvps: { status: string; attendedAt: Date | null }[] } }) {
  const going = s.rsvps.filter((r) => r.status === "GOING");
  const attended = going.filter((r) => r.attendedAt).length;
  const isPast = s.startsAt < new Date();
  return (
    <Link href={`/admin/training/sessions/${s.id}`} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-green">
      <p className="font-bold text-ink">{s.module.name}</p>
      <p className="inline-flex items-center gap-1.5 text-sm text-ink-soft tabular"><Clock className="size-4 text-green-text" aria-hidden />{formatInstant(s.startsAt)} to {formatInstantTime(s.endsAt)}</p>
      <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-4" aria-hidden />{s.location}</p>
      <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground tabular"><Users className="size-4" aria-hidden />{isPast ? `${attended} attended of ${going.length} booked` : `${going.length} of ${s.capacity} booked`}</p>
    </Link>
  );
}
