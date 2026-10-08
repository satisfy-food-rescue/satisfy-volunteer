import { Mail, Palette, Plug, ShieldCheck, Type } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { formatInstant } from "@/lib/dates";
import { EMAIL_KIND_LABEL, type EmailKind } from "@/lib/domain";
import { PageHeader } from "@/components/shared/page-header";
import { Chip } from "@/components/shared/status-chip";
import Link from "next/link";
import { BrandFooter, Logo } from "@/components/brand/logo";

export const metadata = { title: "Settings" };

// The 2026 brand refresh palette and the role each colour plays in the app.
const SWATCHES = [
  ["Satisfy Green", "--brand-green", "#00A651", "Logo, success, warehouse shifts"],
  ["Blue/Teal", "--brand-teal", "#106379", "Buttons, links, selection, navigation"],
  ["Orange", "--brand-orange", "#E08C3C", "Needs cover, last-minute, badges"],
  ["Light Blue", "--brand-light-blue", "#4395A2", "Driver shifts, info, focus rings"],
];

// Tints printed in the brand refresh, used in the footer ribbons and food icons.
const TINTS = [
  ["Green 50%", "--brand-green-50"],
  ["Green 75%", "--brand-green-75"],
  ["Blue/Teal 90%", "--brand-teal-90"],
  ["Orange 50%", "--brand-orange-50"],
];

export default async function SettingsPage() {
  await requireAdmin();
  const [lastSync, templates] = await Promise.all([
    db.volunteer.findFirst({ where: { infoodleSyncedAt: { not: null } }, orderBy: { infoodleSyncedAt: "desc" }, select: { infoodleSyncedAt: true } }),
    db.email.groupBy({ by: ["kind"], _count: { _all: true } }),
  ]);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader eyebrow="Settings" title="Branding, integrations and templates" />

      <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="brand-h">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal"><Palette className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 id="brand-h" className="text-2xl text-ink">Brand colours and fonts</h2>
            <p className="mt-1 text-ink-soft">The volunteer app and this admin follow the 2026 Satisfy Food Rescue brand refresh. Every colour, radius and typeface lives in one theme file, so a future re-skin is a single-file change: update the values, and every screen, chip, chart and email preview follows. No component contains a hard-coded colour.</p>
            <p className="mt-2 text-sm text-muted-foreground">File: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">src/app/globals.css</code> · fonts in <code className="rounded bg-muted px-1.5 py-0.5 text-xs">src/app/layout.tsx</code></p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-center rounded-xl bg-teal p-6"><Logo tone="white" className="h-24" /></div>
          <div className="flex items-center justify-center rounded-xl border border-border p-6"><Logo className="h-24" /></div>
        </div>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SWATCHES.map(([name, v, hex, use]) => (
            <li key={v} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <span className="size-11 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: `var(${v})` }} aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink">{name} <span className="font-semibold text-muted-foreground tabular">{hex}</span></span>
                <span className="block text-xs text-muted-foreground">{use}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border p-3">
          <span className="eyebrow">Tints</span>
          {TINTS.map(([name, v]) => (
            <span key={v} className="inline-flex items-center gap-2 text-sm text-ink">
              <span className="size-4 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: `var(${v})` }} aria-hidden />
              {name}
            </span>
          ))}
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-border pt-3">
          <p className="eyebrow px-3">Footer</p>
          <BrandFooter className="pb-3 pt-1" />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-4 rounded-xl bg-muted/60 p-4">
          <div className="flex items-center gap-3"><Type className="size-5 text-teal" aria-hidden /><div><p className="font-display text-xl font-bold text-ink">Montserrat</p><p className="text-xs text-muted-foreground">Headings, labels and body: the logo font, as used in the brand refresh</p></div></div>
          <div className="flex items-center gap-3"><ShieldCheck className="size-5 text-teal" aria-hidden /><div><p className="font-semibold text-ink">WCAG AA checked</p><p className="text-xs text-muted-foreground">16px minimum body, 44px tap targets, status never colour-only</p></div></div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="inf-h">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-status-info-bg text-status-info"><Plug className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="inf-h" className="text-2xl text-ink">Infoodle integration</h2>
              <Chip tone="warn">API: pending confirmation</Chip>
            </div>
            <p className="mt-1 text-ink-soft">Infoodle stays the system of record for contacts and donations. This app owns rostering, training and absences. Once Infoodle confirms API access, the sync below runs nightly and on demand.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <p className="font-display text-xs font-bold uppercase tracking-wide text-teal">Infoodle to this app</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
              <li>New sign-up form submissions appear in Applications automatically.</li>
              <li>Approved applicants keep their Infoodle record id, so nothing is double-entered.</li>
              <li>Contact changes made in Infoodle overwrite the copy here.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="font-display text-xs font-bold uppercase tracking-wide text-teal">This app to Infoodle</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
              <li>Phone, emergency contact and availability edits made by volunteers.</li>
              <li>Volunteer status (active, inactive) and role tags.</li>
              <li>Optionally: hours volunteered per month, for funder reporting.</li>
            </ul>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Mocked in this demo: last sync shown as {lastSync?.infoodleSyncedAt ? formatInstant(lastSync.infoodleSyncedAt) : "never"}. If Infoodle has no API, the fallback is a scheduled CSV import/export with the same field mapping.</p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="tpl-h">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-ink"><Mail className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 id="tpl-h" className="text-2xl text-ink">Email templates</h2>
            <p className="mt-1 text-ink-soft">Every template renders with the brand header and a single call to action. Wording lives in one file so the coordinator&apos;s edits are quick to apply. Click a template to see a real example from the Outbox.</p>
          </div>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(EMAIL_KIND_LABEL) as EmailKind[]).map((k) => {
            const count = templates.find((t) => t.kind === k)?._count._all ?? 0;
            return (
              <li key={k}>
                <Link href={`/admin/outbox?kind=${k}`} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5 text-sm hover:border-teal/60">
                  <span className="font-semibold text-ink">{EMAIL_KIND_LABEL[k]}</span>
                  <span className="text-xs text-muted-foreground tabular">{count} in Outbox</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-dashed border-border bg-card/60 p-5 text-sm text-muted-foreground">
        <p className="font-bold text-ink">What is mocked in this demo</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Sign-in: four personas set a cookie. Production uses email sign-in with passkeys.</li>
          <li>Email and push notifications: nothing is sent; every message is captured in the Outbox.</li>
          <li>Infoodle: sync status and record ids are sample data.</li>
          <li>Database: SQLite for zero setup. The schema is Postgres-compatible for production.</li>
        </ul>
      </section>
    </div>
  );
}
