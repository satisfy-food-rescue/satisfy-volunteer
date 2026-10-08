import Link from "next/link";
import { CalendarCheck, Clock, Mail, MapPin, Phone, RefreshCw, UserPlus } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { formatInstant } from "@/lib/dates";
import { INITIAL_VISIT_CODE, ROLE_SHORT, parseRoles } from "@/lib/domain";
import { PageHeader } from "@/components/shared/page-header";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { Chip } from "@/components/shared/status-chip";
import { ApplicationReview } from "@/components/admin/application-review";

export const metadata = { title: "Applications" };

export default async function ApplicationsPage() {
  await requireAdmin();
  const [apps, induction] = await Promise.all([
    db.application.findMany({ orderBy: [{ submittedAt: "desc" }] }),
    db.trainingSession.findFirst({ where: { startsAt: { gte: new Date() }, module: { code: INITIAL_VISIT_CODE } }, orderBy: { startsAt: "asc" } }),
  ]);
  const pending = apps.filter((a) => a.status === "PENDING");
  const reviewed = apps.filter((a) => a.status !== "PENDING");
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader eyebrow="Applications" title="New volunteer applications" description="Applicants fill in the sign-up form on the website, which lands in Infoodle. Approved applicants get an account here and a welcome email. Then give them a call and book their initial visit from their profile." />

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
        <RefreshCw className="mt-0.5 size-5 shrink-0 text-sky" aria-hidden />
        <div>
          <p className="font-bold text-ink">Source: Infoodle sign-up form (mocked)</p>
          <p className="text-muted-foreground">When the Infoodle API is confirmed, new form submissions appear here automatically. Until then the coordinator can add them by hand. On approval: account created, welcome email queued{induction ? `, pencilled into the next open initial-visit slot (${formatInstant(induction.startsAt)}) if there is room` : ""}, Infoodle record flagged as active volunteer.</p>
        </div>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="pending-h">
        <h2 id="pending-h" className="text-2xl text-ink">Awaiting review <span className="font-sans text-base text-muted-foreground tabular">({pending.length})</span></h2>
        {pending.length === 0 && <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-muted-foreground">Queue is clear.</p>}
        {pending.map((a) => (
          <article key={a.id} id={a.id} className="scroll-mt-6 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start gap-4">
              <AvatarBadge person={a} size="lg" />
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-bold text-ink">{a.firstName} {a.lastName}{a.birthYear ? <span className="ml-2 text-base font-normal text-muted-foreground">{new Date().getFullYear() - a.birthYear}</span> : null}</h3>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
                  {a.suburb && <span className="inline-flex items-center gap-1"><MapPin className="size-4 text-sky" aria-hidden />{a.suburb}</span>}
                  <span className="inline-flex items-center gap-1"><Mail className="size-4 text-sky" aria-hidden />{a.email}</span>
                  {a.phone && <span className="inline-flex items-center gap-1 tabular"><Phone className="size-4 text-sky" aria-hidden />{a.phone}</span>}
                </p>
                <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <div><dt className="font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">Interested in</dt><dd className="mt-0.5 flex flex-wrap gap-1">{parseRoles(a.interests).map((r) => <Chip key={r} tone="good" size="sm">{ROLE_SHORT[r]}</Chip>)}</dd></div>
                  <div><dt className="font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">Availability</dt><dd className="mt-0.5 text-ink">{a.availability}</dd></div>
                  {a.message && <div className="sm:col-span-2"><dt className="font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">Message</dt><dd className="mt-0.5 text-ink">&ldquo;{a.message}&rdquo;</dd></div>}
                </dl>
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3.5" aria-hidden />Submitted {formatInstant(a.submittedAt)} · Infoodle {a.infoodleId}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="inline-flex items-start gap-2 text-sm text-muted-foreground"><UserPlus className="mt-0.5 size-4 shrink-0 text-sky" aria-hidden />Approving creates the account and queues the welcome email. Book the initial visit from their profile.</p>
              <ApplicationReview id={a.id} firstName={a.firstName} />
            </div>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="rev-h">
        <h2 id="rev-h" className="text-2xl text-ink">Recently reviewed</h2>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {reviewed.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <AvatarBadge person={a} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink">{a.firstName} {a.lastName}</span>
                <span className="block text-xs text-muted-foreground">{a.status === "APPROVED" ? "Approved" : "Declined"} {a.reviewedAt ? formatInstant(a.reviewedAt) : ""}{a.reviewNote ? ` · ${a.reviewNote}` : ""}</span>
              </span>
              {a.status === "APPROVED" ? <Chip tone="good" size="sm" icon={CalendarCheck}>Approved</Chip> : <Chip tone="neutral" size="sm">Declined</Chip>}
              {a.volunteerId && <Link href={`/admin/volunteers/${a.volunteerId}`} className="text-sm font-semibold text-teal hover:underline">Profile</Link>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
