import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, Import, Mail, Smartphone } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { isDemo } from "@/lib/env";
import { db } from "@/lib/db";
import { TEMPLATES, type TemplateAudience } from "@/lib/email-templates";
import { PageHeader } from "@/components/shared/page-header";
import { Chip } from "@/components/shared/status-chip";

export const metadata = { title: "Emails and import" };

const GROUPS: { heading: string; audience: TemplateAudience[] }[] = [
  { heading: "To volunteers", audience: ["volunteer", "applicant"] },
  { heading: "To coordinators", audience: ["coordinator"] },
];

export default async function SettingsPage() {
  await requireAdmin();
  const demo = isDemo();
  const [imported, custom] = await Promise.all([
    db.volunteer.count({ where: { infoodleId: { not: null } } }),
    db.emailTemplate.findMany({ select: { key: true } }),
  ]);
  const customKeys = new Set(custom.map((c) => c.key));
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader eyebrow="Set-up" title="Emails and import" description="The messages the system sends by itself and when it sends them, and how volunteer records came across from Infoodle." />

      <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="tpl-h">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal"><Mail className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 id="tpl-h" className="text-2xl text-ink">Automatic emails</h2>
            <p className="mt-1 text-ink-soft">Each one carries the Satisfy header and a single button. Some go as a push notification to volunteers with the app on their phone. Open one to change its wording: your version is used for every one sent from then on, and you can go back to the standard wording at any time.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-6 @4xl/admin:grid-cols-[3fr_2fr]">
          {GROUPS.map((group) => (
            <div key={group.heading}>
              <h3 className="eyebrow mb-2">{group.heading}</h3>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {TEMPLATES.filter((t) => group.audience.includes(t.audience)).map((t) => (
                  <li key={t.key}>
                    <Link href={`/admin/emails/${t.key}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted">
                      {t.channel === "PUSH" ? <Smartphone className="size-4 shrink-0 text-orange-text" aria-label="Push notification" /> : <Mail className="size-4 shrink-0 text-sky" aria-label="Email" />}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink">{t.name}</span>
                        <span className="block text-xs text-muted-foreground">{t.when}</span>
                      </span>
                      {customKeys.has(t.key) && <Chip tone="info" size="sm" className="shrink-0">Your wording</Chip>}
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Announcements are not here: they are written fresh each time. To see what was actually sent, open the <Link href="/admin/outbox" className="font-semibold text-teal hover:underline">Outbox</Link>.</p>
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
