import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { formatInstant, formatInstantTime } from "@/lib/dates";
import { EMAIL_KIND_LABEL } from "@/lib/domain";
import { env, isDemo } from "@/lib/env";
import { emailAudience } from "@/lib/emails";
import { FOOTER_NOTE } from "@/lib/mailer";
import { MessagePreview } from "@/components/admin/message-preview";
import { DeliveryChip } from "@/components/shared/status-chip";

export const metadata = { title: "Message preview" };

export default async function EmailPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const e = await db.email.findUnique({ where: { id } });
  if (!e) notFound();
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

      <MessagePreview m={{ push, subject: e.subject, preview: e.preview, body: e.body, ctaLabel: e.ctaLabel, ctaHref: e.ctaHref, signInLink, footerNote: FOOTER_NOTE[emailAudience(e)], time: formatInstantTime(e.createdAt) }} />
    </div>
  );
}
