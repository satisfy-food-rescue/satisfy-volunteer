import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { formatInstant, formatInstantTime } from "@/lib/dates";
import { EMAIL_KIND_LABEL, type EmailKind } from "@/lib/domain";
import { ORG } from "@/lib/brand";
import { LogoMark } from "@/components/brand/logo";

export const metadata = { title: "Message preview" };

export default async function EmailPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const e = await db.email.findUnique({ where: { id } });
  if (!e) notFound();
  const paragraphs = e.body.split("\n\n");
  const push = e.channel === "PUSH";
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/admin/outbox" className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-ink"><ChevronLeft className="size-5" aria-hidden /> Outbox</Link>
      <div>
        <p className="eyebrow">{push ? "Push notification" : "Email preview"} · {EMAIL_KIND_LABEL[e.kind as EmailKind]}</p>
        <h1 className="mt-1 text-2xl text-ink">{e.subject}</h1>
      </div>
      <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
        <dt className="font-semibold text-muted-foreground">From</dt><dd className="text-ink">{push ? "Satisfy volunteer app" : <>{ORG.name} &lt;{ORG.coordinatorEmail}&gt;</>}</dd>
        <dt className="font-semibold text-muted-foreground">To</dt><dd className="text-ink">{push ? `${e.toName}'s phone` : <>{e.toName} &lt;{e.toEmail}&gt;</>}</dd>
        <dt className="font-semibold text-muted-foreground">Generated</dt><dd className="text-ink tabular">{formatInstant(e.createdAt)}</dd>
        <dt className="font-semibold text-muted-foreground">Preview</dt><dd className="text-ink-soft">{e.preview}</dd>
      </dl>

      {push ? (
        // Rendered like a lock-screen notification. Tapping opens the shift in the app.
        <div className="rounded-2xl border border-border bg-green-deep p-6 sm:p-10">
          <div className="mx-auto max-w-[24rem]">
            <p className="text-center font-display text-5xl font-bold text-white tabular">{formatInstantTime(e.createdAt)}</p>
            <div className="mt-6 rounded-2xl bg-white/90 p-3.5 shadow-lg backdrop-blur">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <LogoMark size={20} />
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
      <div className="rounded-2xl border border-border bg-app-backdrop p-4 sm:p-8">
        <div className="mx-auto max-w-[36rem] overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b-4 border-green px-6 py-5">
            <LogoMark size={44} />
            <div className="leading-tight">
              <p className="font-display text-base font-bold tracking-[0.08em] text-ink">SATISFY</p>
              <p className="text-[0.62rem] font-display font-bold uppercase tracking-[0.2em] text-green-text">food rescue</p>
            </div>
          </div>
          <div className="px-6 py-6 text-[1.05rem] leading-relaxed text-ink">
            {paragraphs.map((p, i) => (
              <p key={i} className="mb-4 whitespace-pre-line last:mb-0">{p}</p>
            ))}
            {e.ctaLabel && e.ctaHref && (
              <p className="my-6">
                <Link href={e.ctaHref} className="inline-block rounded-full bg-green-fill px-6 py-3 font-display font-bold text-white no-underline hover:bg-green-fill-hover">{e.ctaLabel}</Link>
              </p>
            )}
          </div>
          <div className="bg-canvas px-6 py-4 text-xs leading-relaxed text-muted-foreground">
            <p>{ORG.name} · {ORG.base}</p>
            <p>You are receiving this because you volunteer with Satisfy. Manage your details in the volunteer app.</p>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
