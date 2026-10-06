import Link from "next/link";
import { ArrowRight, Mail, Smartphone } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { isDemo } from "@/lib/env";
import { formatInstant } from "@/lib/dates";
import { EMAIL_KIND_LABEL, type EmailKind } from "@/lib/domain";
import { PageHeader } from "@/components/shared/page-header";
import { Chip, DeliveryChip } from "@/components/shared/status-chip";
import { cn } from "@/lib/utils";

export const metadata = { title: "Outbox" };

const TONE: Partial<Record<EmailKind, "good" | "warn" | "bad" | "info" | "neutral">> = {
  TRAINING_OVERDUE: "bad", TRAINING_OVERDUE_COORDINATOR: "bad", TRAINING_DUE_SOON: "warn", GAP_ALERT: "bad", COVER_CONFIRMED: "good", TRAINING_COMPLETED: "good", APPLICATION_APPROVED: "good", ACCOUNT_INVITE: "info", PASSWORD_RESET: "info", SESSION_CONFIRMED: "info", HARVEST_CALLOUT: "info", SHIFT_REMINDER: "neutral", ABSENCE_CONFIRMED: "neutral", LAST_MINUTE_CALLOUT: "bad", GAP_ESCALATION: "bad", ROLES_CHANGED: "info", ROLE_CHANGE_REQUEST: "info",
};

const FAILED = "failed";

export default async function OutboxPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requireAdmin();
  const { kind: rawKind } = await searchParams;
  const demo = isDemo();
  const kind = rawKind && rawKind in EMAIL_KIND_LABEL ? (rawKind as EmailKind) : undefined;
  const showFailed = rawKind === FAILED;
  const where: Prisma.EmailWhereInput | undefined = showFailed ? { status: "FAILED" } : kind ? { kind } : undefined;
  const [emails, kinds, failed] = await Promise.all([
    db.email.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }),
    db.email.groupBy({ by: ["kind"], _count: { _all: true } }),
    demo ? 0 : db.email.count({ where: { status: "FAILED" } }),
  ]);
  const pill = (active: boolean) =>
    cn("flex h-10 items-center rounded-full border px-3 text-sm font-semibold", active ? "border-green bg-green-tint text-green-deep" : "border-border bg-card text-muted-foreground hover:text-ink");
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {demo ? (
        <PageHeader eyebrow="Outbox" title="Every email and notification the system would send" description="Nothing leaves this demo. Each entry is exactly what the volunteer or coordinator would receive, rendered from the same templates production uses. Push notifications go to the volunteer app on their phone." />
      ) : (
        <PageHeader eyebrow="Outbox" title="Every email the system has sent" description="Reminders, confirmations and alerts, newest first. Anything that could not be delivered is retried automatically for two days." />
      )}
      <div className="flex flex-wrap gap-1.5">
        <Link href="/admin/outbox" className={pill(!kind && !showFailed)}>All ({kinds.reduce((n, k) => n + k._count._all, 0)})</Link>
        {failed > 0 && (
          <Link href={`/admin/outbox?kind=${FAILED}`} className={cn(pill(showFailed), !showFailed && "text-status-bad")}>Not delivered ({failed})</Link>
        )}
        {kinds.sort((a, b) => b._count._all - a._count._all).map((k) => (
          <Link key={k.kind} href={`/admin/outbox?kind=${k.kind}`} className={pill(kind === k.kind)}>
            {EMAIL_KIND_LABEL[k.kind]} ({k._count._all})
          </Link>
        ))}
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {emails.length === 0 && <li className="px-4 py-10 text-center text-muted-foreground">Nothing here yet.</li>}
        {emails.map((e) => (
          <li key={e.id}>
            <Link href={`/admin/outbox/${e.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-muted">
              <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg", e.channel === "PUSH" ? "bg-pink-tint text-pink-text" : "bg-muted text-muted-foreground")}>
                {e.channel === "PUSH" ? <Smartphone className="size-4" aria-label="Push notification" /> : <Mail className="size-4" aria-label="Email" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-bold text-ink">{e.subject}</span>
                  <Chip tone={TONE[e.kind] ?? "neutral"} size="sm">{EMAIL_KIND_LABEL[e.kind]}</Chip>
                  {!demo && <DeliveryChip status={e.status} />}
                </span>
                <span className="block truncate text-sm text-ink-soft">{e.preview}</span>
                <span className="block text-xs text-muted-foreground">{e.channel === "PUSH" ? `To ${e.toName}'s phone` : <>To {e.toName} &lt;{e.toEmail}&gt;</>} · {formatInstant(e.createdAt)}</span>
              </span>
              <ArrowRight className="mt-2 size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
