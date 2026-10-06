import { Mail, Palette, Plug, ShieldCheck, Type } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { isDemo } from "@/lib/env";
import { db } from "@/lib/db";
import { formatInstant } from "@/lib/dates";
import { EMAIL_KIND_LABEL, type EmailKind } from "@/lib/domain";
import { PageHeader } from "@/components/shared/page-header";
import { Chip } from "@/components/shared/status-chip";
import Link from "next/link";

export const metadata = { title: "Settings" };

const SWATCHES = [
  ["Satisfy green", "--brand-green", "Primary. Fills, buttons, active states"],
  ["Green text", "--green-text", "Links, icons, text on white (AA)"],
  ["Deep green", "--green-deep", "Text on green fills"],
  ["Pale green", "--green-tint", "Tinted panels and badges"],
  ["Pink", "--pink-fill", "One high-emphasis action: cover a gap"],
  ["Ink", "--ink", "Headings and body text"],
  ["Canvas", "--canvas", "Page background"],
];

// Secondary colours from the Brand Guidelines, used for charts and avatars.
const SECONDARY = [
  ["Yellow", "--brand-yellow"],
  ["Orange", "--brand-orange"],
  ["Pink", "--brand-pink"],
  ["Dark blue", "--brand-dark-blue"],
  ["Light blue", "--brand-light-blue"],
  ["Teal", "--brand-teal"],
];

export default async function SettingsPage() {
  await requireAdmin();
  const demo = isDemo();
  const [lastSync, templates] = await Promise.all([
    db.volunteer.findFirst({ where: { infoodleSyncedAt: { not: null } }, orderBy: { infoodleSyncedAt: "desc" }, select: { infoodleSyncedAt: true } }),
    db.email.groupBy({ by: ["kind"], _count: { _all: true } }),
  ]);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader eyebrow="Settings" title="Branding, integrations and templates" />

      <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="brand-h">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-green-tint text-green-deep"><Palette className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 id="brand-h" className="text-2xl text-ink">Brand colours and fonts</h2>
            <p className="mt-1 text-ink-soft">The volunteer app and this admin follow the Satisfy Food Rescue Brand Guidelines. Every colour, radius and typeface lives in one theme file, so a future re-skin is a single-file change: update the values, and every screen, chip, chart and email preview follows. No component contains a hard-coded colour.</p>
            <p className="mt-2 text-sm text-muted-foreground">File: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">src/app/globals.css</code> · fonts in <code className="rounded bg-muted px-1.5 py-0.5 text-xs">src/app/layout.tsx</code></p>
          </div>
        </div>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 @4xl/admin:grid-cols-4">
          {SWATCHES.map(([name, v, use]) => (
            <li key={v} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <span className="size-10 shrink-0 rounded-lg ring-1 ring-black/10" style={{ background: `var(${v})` }} aria-hidden />
              <span className="min-w-0"><span className="block text-sm font-bold text-ink">{name}</span><span className="block truncate text-xs text-muted-foreground">{use}</span></span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border p-3">
          <span className="eyebrow">Secondary</span>
          {SECONDARY.map(([name, v]) => (
            <span key={v} className="inline-flex items-center gap-2 text-sm text-ink">
              <span className="size-4 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: `var(${v})` }} aria-hidden />
              {name}
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 rounded-xl bg-muted/60 p-4">
          <div className="flex items-center gap-3"><Type className="size-5 text-green-text" aria-hidden /><div><p className="font-display font-bold text-xl text-ink">Montserrat</p><p className="text-xs text-muted-foreground">Headings and subheadings, the logo font</p></div></div>
          <div className="flex items-center gap-3"><Type className="size-5 text-green-text" aria-hidden /><div><p className="text-xl font-semibold text-ink">Roboto Slab</p><p className="text-xs text-muted-foreground">Body, stand-in for Stag until a web licence is in place</p></div></div>
          <div className="flex items-center gap-3"><ShieldCheck className="size-5 text-green-text" aria-hidden /><div><p className="font-semibold text-ink">WCAG AA checked</p><p className="text-xs text-muted-foreground">16px minimum body, 44px tap targets, status never colour-only</p></div></div>
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
            <p className="font-display text-xs font-bold uppercase tracking-wide text-green-text">Infoodle to this app</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
              <li>New sign-up form submissions appear in Applications automatically.</li>
              <li>Approved applicants keep their Infoodle record id, so nothing is double-entered.</li>
              <li>Contact changes made in Infoodle overwrite the copy here.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="font-display text-xs font-bold uppercase tracking-wide text-green-text">This app to Infoodle</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
              <li>Phone, emergency contact and availability edits made by volunteers.</li>
              <li>Volunteer status (active, inactive) and role tags.</li>
              <li>Optionally: hours volunteered per month, for funder reporting.</li>
            </ul>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {demo ? `Mocked in this demo: last sync shown as ${lastSync?.infoodleSyncedAt ? formatInstant(lastSync.infoodleSyncedAt) : "never"}. ` : "Not connected yet: contact details are kept here until the sync is in place. "}
          If Infoodle has no API, the fallback is a scheduled CSV import/export with the same field mapping.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="tpl-h">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-ink"><Mail className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 id="tpl-h" className="text-2xl text-ink">Email templates</h2>
            <p className="mt-1 text-ink-soft">Every template renders with the brand header and a single call to action. Wording lives in one file so the coordinator&apos;s edits are quick to apply. Click a template to see a real example from the Outbox.</p>
          </div>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 @4xl/admin:grid-cols-3">
          {(Object.keys(EMAIL_KIND_LABEL) as EmailKind[]).map((k) => {
            const count = templates.find((t) => t.kind === k)?._count._all ?? 0;
            return (
              <li key={k}>
                <Link href={`/admin/outbox?kind=${k}`} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5 text-sm hover:border-green">
                  <span className="font-semibold text-ink">{EMAIL_KIND_LABEL[k]}</span>
                  <span className="text-xs text-muted-foreground tabular">{count} in Outbox</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {demo && (
        <section className="rounded-2xl border border-dashed border-border bg-card/60 p-5 text-sm text-muted-foreground">
          <p className="font-bold text-ink">What is different in this demo</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Sign-in: pick a persona. Production uses a password, Google or a passkey.</li>
            <li>Email and push notifications: nothing is sent; every message is captured in the Outbox.</li>
            <li>Infoodle: sync status and record ids are sample data.</li>
            <li>Data: regenerated every day relative to today.</li>
          </ul>
        </section>
      )}
    </div>
  );
}
