import Link from "next/link";
import { CalendarCheck, Clock, History, LifeBuoy, Link2, Mail, MapPin, Phone, XCircle } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { formatInstant } from "@/lib/dates";
import { INITIAL_VISIT_CODE, ROLE_SHORT, applicationSourceLabel } from "@/lib/domain";
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
  // Someone signing up again after they stopped volunteering.
  const known = await db.volunteer.findMany({ where: { email: { in: pending.map((a) => a.email) } }, select: { id: true, email: true, status: true, role: true } });
  const accountFor = new Map(known.map((v) => [v.email, v]));
  const signUpUrl = new URL("/sign-up", env().APP_URL).toString();
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader eyebrow="People" title="Applications" description="New volunteers who sign up on the website or in the app wait here for you to review." />

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
        <Link2 className="mt-0.5 size-5 shrink-0 text-sky" aria-hidden />
        <div className="min-w-0">
          <p className="font-bold text-ink">Share the sign-up form</p>
          <p className="text-muted-foreground">
            <a href={signUpUrl} target="_blank" rel="noreferrer" className="break-all font-semibold text-teal hover:underline">{signUpUrl}</a>, or Sign up to volunteer in the Satisfy volunteer app. Each one is emailed to you as well. Approving creates their account and emails them a sign-in invite{induction ? `, and pencils them into the next initial visit (${formatInstant(induction.startsAt)}) if there is room` : ""}. Then give them a call, and book their initial visit from their profile if they are not booked in yet.
          </p>
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
                <h3 className="text-xl font-bold text-ink">{a.firstName} {a.lastName}{a.birthYear ? <span className="ml-2 text-base font-normal text-muted-foreground">aged {new Date().getFullYear() - a.birthYear}</span> : null}</h3>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
                  {a.suburb && <span className="inline-flex items-center gap-1"><MapPin className="size-4 text-sky" aria-hidden />{a.suburb}</span>}
                  <span className="inline-flex items-center gap-1"><Mail className="size-4 text-sky" aria-hidden />{a.email}</span>
                  {a.phone && <span className="inline-flex items-center gap-1 tabular"><Phone className="size-4 text-sky" aria-hidden />{a.phone}</span>}
                </p>
                <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm @2xl/admin:grid-cols-2">
                  <div><dt className="font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">Interested in</dt><dd className="mt-0.5 flex flex-wrap gap-1">{a.interests.map((r) => <Chip key={r} tone="good" size="sm">{ROLE_SHORT[r]}</Chip>)}</dd></div>
                  <div><dt className="font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">Availability</dt><dd className="mt-0.5 text-ink">{a.availability}</dd></div>
                  {(a.emergencyName || a.emergencyPhone) && <div><dt className="font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">Emergency contact</dt><dd className="mt-0.5 inline-flex flex-wrap items-center gap-x-2 text-ink"><LifeBuoy className="size-4 text-sky" aria-hidden />{a.emergencyName}{a.emergencyPhone && <span className="tabular">{a.emergencyPhone}</span>}</dd></div>}
                  {a.message && <div className="@2xl/admin:col-span-2"><dt className="font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">Message</dt><dd className="mt-0.5 text-ink">&ldquo;{a.message}&rdquo;</dd></div>}
                </dl>
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3.5" aria-hidden />Submitted {formatInstant(a.submittedAt)} · {applicationSourceLabel(a.source)}</p>
                {accountFor.get(a.email) && (
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-status-info-bg px-3 py-2 text-sm text-status-info">
                    <History className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      {accountFor.get(a.email)!.status === "ACTIVE" ? "Already has an active account with this email." : accountFor.get(a.email)!.role === "ADMIN"
                        ? "Was a coordinator. Approving reactivates their account as a volunteer, with their history and training. Coordinator access is only given back from Coordinators."
                        : "Volunteered with Satisfy before. Approving reactivates their account, with their history and training."}{" "}
                      <Link href={`/admin/volunteers/${accountFor.get(a.email)!.id}`} className="font-semibold underline underline-offset-2">Their profile</Link>
                    </span>
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
              <ApplicationReview id={a.id} firstName={a.firstName} />
            </div>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="rev-h">
        <h2 id="rev-h" className="text-2xl text-ink">Recently reviewed</h2>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {reviewed.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">No applications reviewed yet.</li>}
          {reviewed.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <AvatarBadge person={a} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink">{a.firstName} {a.lastName}</span>
                <span className="block text-xs text-muted-foreground">{a.status === "APPROVED" ? "Approved" : "Declined"} {a.reviewedAt ? formatInstant(a.reviewedAt) : ""}{a.reviewNote ? ` · ${a.reviewNote}` : ""}</span>
              </span>
              {a.status === "APPROVED" ? <Chip tone="good" size="sm" icon={CalendarCheck}>Approved</Chip> : <Chip tone="neutral" size="sm" icon={XCircle}>Declined</Chip>}
              {a.volunteerId && <Link href={`/admin/volunteers/${a.volunteerId}`} className="text-sm font-semibold text-teal hover:underline">Profile</Link>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
