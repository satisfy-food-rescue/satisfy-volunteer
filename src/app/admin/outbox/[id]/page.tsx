import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { formatInstant, formatInstantTime } from "@/lib/dates";
import { EMAIL_KIND_LABEL } from "@/lib/domain";
import { ORG } from "@/lib/brand";
import { env, isDemo } from "@/lib/env";
import { emailAudience } from "@/lib/emails";
import { FOOTER_NOTE } from "@/lib/mailer";
import { Logo, LogoIcon } from "@/components/brand/logo";
import { DeliveryChip } from "@/components/shared/status-chip";

export const metadata = { title: "Message preview" };

export default async function EmailPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const e = await db.email.findUnique({ where: { id } });
  if (!e) notFound();
  const paragraphs = e.body.split("\n\n");
  const push = e.channel === "PUSH";
  const demo = isDemo();
  const signInLink = e.kind === "ACCOUNT_INVITE" || e.kind === "PASSWORD_RESET";
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Link href="/admin/outbox" className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-ink"><ChevronLeft className="size-5" aria-hidden /> Outbox</Link>
      <div>
        <p className="eyebrow">{push ? "Push notification" : "Email preview"} · {EMAIL_KIND_LABEL[e.kind]}</p>
        <h1 className="mt-1 text-3xl text-ink @4xl/admin:text-4xl">{e.subject}</h1>
      </div>
      <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
        <dt className="font-semibold text-muted-foreground">From</dt><dd className="text-ink">{push ? "Satisfy volunteer app" : env().EMAIL_FROM}</dd>
        <dt className="font-semibold text-muted-foreground">To</dt><dd className="text-ink">{push ? `${e.toName}'s phone` : <>{e.toName} &lt;{e.toEmail}&gt;</>}</dd>
        <dt className="font-semibold text-muted-foreground">Created</dt><dd className="text-ink tabular">{formatInstant(e.createdAt)}</dd>
        {!demo && (
          <>
            <dt className="font-semibold text-muted-foreground">Status</dt>
            <dd className="flex flex-wrap items-center gap-2 text-ink">
              <DeliveryChip status={e.status} />
              {e.sentAt && <span className="tabular text-ink-soft">{formatInstant(e.sentAt)}</span>}
              {e.status === "FAILED" && e.lastError && <span className="text-status-bad">{e.lastError}</span>}
            </dd>
          </>
        )}
        <dt className="font-semibold text-muted-foreground">Preview</dt><dd className="text-ink-soft">{e.preview}</dd>
      </dl>

      {push ? (
        // Rendered like a lock-screen notification. Tapping opens the shift in the app.
        <div className="rounded-2xl bg-teal-deep p-6 @xl/admin:p-10">
          <div className="mx-auto max-w-[24rem]">
            <p className="text-center font-display text-5xl font-bold text-white tabular">{formatInstantTime(e.createdAt)}</p>
            <div className="mt-6 rounded-2xl bg-white/90 p-3.5 shadow-lg backdrop-blur">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-teal"><LogoIcon tone="white" className="size-3.5" /></span>
                <span className="font-semibold uppercase tracking-wide">Satisfy</span>
                <span className="ml-auto">now</span>
              </div>
              <p className="mt-1.5 font-bold text-ink">{e.subject}</p>
              <p className="text-sm leading-snug text-ink-soft">{e.preview}</p>
            </div>
            {e.ctaHref && (
              <p className="mt-4 text-center text-sm text-white/80">
                Tapping it opens <Link href={e.ctaHref} className="font-semibold text-white underline underline-offset-2">the shift in the volunteer app</Link>.
              </p>
            )}
          </div>
        </div>
      ) : (
      /* Rendered like the real email: brand header, one call to action, quiet footer. */
      <div className="rounded-2xl border border-border bg-app-backdrop p-4 @xl/admin:p-8">
        <div className="mx-auto max-w-[36rem] overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="flex justify-center bg-teal px-6 py-6">
            <Logo tone="white" className="h-16" />
          </div>
          <div className="px-6 py-6 text-[1.05rem] leading-relaxed text-ink">
            {paragraphs.map((p, i) => (
              <p key={i} className="mb-4 whitespace-pre-line last:mb-0">{p}</p>
            ))}
            {e.ctaLabel && e.ctaHref && (
              <p className="my-6">
                <Link href={e.ctaHref} className="inline-block rounded-full bg-teal px-6 py-3 font-display font-bold text-white no-underline hover:bg-teal-deep">{e.ctaLabel}</Link>
              </p>
            )}
            {e.ctaLabel && signInLink && (
              <p className="my-6">
                <span className="inline-block rounded-full bg-teal px-6 py-3 font-display font-bold text-white">{e.ctaLabel}</span>
                <span className="mt-2 block text-sm text-muted-foreground">The sign-in link is single-use and never stored, so it is not shown here.</span>
              </p>
            )}
          </div>
          {/* The brand ribbons as the email draws them: a simple three-colour
              rule. The page's own footer already shows the full ribbons. */}
          <div className="grid h-1 grid-cols-3" aria-hidden>
            <span className="bg-teal" />
            <span className="bg-(--brand-orange-50)" />
            <span className="bg-green" />
          </div>
          <div className="bg-background px-6 py-4 text-xs leading-relaxed text-muted-foreground">
            <p>{ORG.name} · {ORG.base}</p>
            <p>{FOOTER_NOTE[emailAudience(e)]}</p>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
