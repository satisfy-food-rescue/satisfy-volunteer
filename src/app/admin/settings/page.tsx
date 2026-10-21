import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, Import, Mail } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { isDemo } from "@/lib/env";
import { db } from "@/lib/db";
import { EMAIL_KIND_LABEL, type EmailKind } from "@/lib/domain";
import { PageHeader } from "@/components/shared/page-header";
import { Chip } from "@/components/shared/status-chip";

export const metadata = { title: "Emails and import" };

// Every message the system sends by itself, who gets it and when.
const TEMPLATES: { heading: string; kinds: [EmailKind, string][] }[] = [
  {
    heading: "To volunteers",
    kinds: [
      ["SHIFT_REMINDER", "4pm the day before each shift."],
      ["ABSENCE_CONFIRMED", "When they mark themselves away, or you record it for them."],
      ["COVER_CONFIRMED", "When they take a shift that needed cover."],
      ["LAST_MINUTE_CALLOUT", "A push notification when a gap opens inside the shift type's last-minute window."],
      ["SHIFT_PUBLISHED", "When you publish a one-off shift with a callout."],
      ["HARVEST_CALLOUT", "When you publish a harvest, to the whole harvest pool."],
      ["SHIFT_ADDED", "When you put them on a shift."],
      ["SHIFT_CANCELLED", "When you cancel a shift they are booked on."],
      ["ANNOUNCEMENT", "When you send an announcement."],
      ["TRAINING_DUE_SOON", "Before a module they need runs out."],
      ["TRAINING_OVERDUE", "When a module runs out, then weekly until it is refreshed."],
      ["TRAINING_COMPLETED", "When they complete a module in the app."],
      ["SESSION_CONFIRMED", "When they book a training session, or you book their initial visit."],
      ["APPLICATION_RECEIVED", "When they sign up to volunteer."],
      ["ALREADY_REGISTERED", "When they sign up with an email that already has an account."],
      ["APPLICATION_APPROVED", "When you approve their application."],
      ["ACCOUNT_INVITE", "When an account is made for them, with a link to sign in."],
      ["PASSWORD_RESET", "When they ask to set or reset their password."],
    ],
  },
  {
    heading: "To coordinators",
    kinds: [
      ["GAP_ALERT", "As soon as an absence or cancellation leaves a shift short."],
      ["GAP_ESCALATION", "When a shift is still short at the shift type's alert threshold."],
      ["APPLICATION_NEW", "When a new application is waiting for review."],
      ["TRAINING_OVERDUE_COORDINATOR", "When a volunteer's training is three weeks overdue."],
      ["ROLE_CHANGE_REQUEST", "When a volunteer asks to change roles from the app."],
      ["ROLES_CHANGED", "When a coordinator changes a volunteer's roles."],
      ["ADMIN_ACCESS", "When someone is given coordinator access, or loses it."],
    ],
  },
];

export default async function SettingsPage() {
  await requireAdmin();
  const demo = isDemo();
  const [imported, sent] = await Promise.all([
    db.volunteer.count({ where: { infoodleId: { not: null } } }),
    db.email.groupBy({ by: ["kind"], _count: { _all: true } }),
  ]);
  const countOf = (k: EmailKind) => sent.find((t) => t.kind === k)?._count._all ?? 0;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader eyebrow="Set-up" title="Emails and import" description="The messages the system sends by itself and when it sends them, and how volunteer records came across from Infoodle." />

      <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="tpl-h">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal"><Mail className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 id="tpl-h" className="text-2xl text-ink">Automatic emails</h2>
            <p className="mt-1 text-ink-soft">Each one carries the Satisfy header and a single button. Some go as a push notification to volunteers with the app on their phone. Open one to see the latest real example in the Outbox. To change the wording of a message, send the new text to whoever looks after this site.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-6 @4xl/admin:grid-cols-[3fr_2fr]">
          {TEMPLATES.map((group) => (
            <div key={group.heading}>
              <h3 className="eyebrow mb-2">{group.heading}</h3>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {group.kinds.map(([k, when]) => {
                  const count = countOf(k);
                  return (
                    <li key={k}>
                      <Link href={`/admin/outbox?kind=${k}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-ink">{EMAIL_KIND_LABEL[k]}</span>
                          <span className="block text-xs text-muted-foreground">{when}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular">{count === 0 ? "None yet" : `${count} sent`}</span>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="inf-h">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal"><Import className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="inf-h" className="text-2xl text-ink">Infoodle import</h2>
              {imported > 0 ? (
                <Chip tone="good" icon={CheckCircle2}>{imported} {imported === 1 ? "volunteer" : "volunteers"} imported</Chip>
              ) : (
                <Chip tone="neutral" icon={Clock}>Not imported yet</Chip>
              )}
            </div>
            <p className="mt-1 text-ink-soft">Existing volunteers are brought across from Infoodle once, when this app goes live. After that, volunteer details live here: there is no ongoing sync, and new volunteers join through the sign-up form. Each imported volunteer keeps their Infoodle record number on their profile.</p>
          </div>
        </div>
      </section>

      {demo && (
        <section className="rounded-2xl border border-dashed border-border bg-card/60 p-5 text-sm text-muted-foreground">
          <p className="font-bold text-ink">What is different in this demo</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Sign-in: pick a persona. Production uses a password, Google, Apple or a passkey.</li>
            <li>Email and push notifications: nothing is sent; every message is captured in the Outbox.</li>
            <li>Infoodle: the imported volunteers and their record numbers are sample data.</li>
            <li>Data: regenerated every day relative to today.</li>
          </ul>
        </section>
      )}
    </div>
  );
}
