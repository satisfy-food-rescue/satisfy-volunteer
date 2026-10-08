import Link from "next/link";
import { ArrowRight, Mail, Smartphone } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { formatInstant } from "@/lib/dates";
import { EMAIL_KIND_LABEL, type EmailKind } from "@/lib/domain";
import { PageHeader } from "@/components/shared/page-header";
import { Chip } from "@/components/shared/status-chip";
import { cn } from "@/lib/utils";

export const metadata = { title: "Outbox" };

const TONE: Partial<Record<EmailKind, "good" | "warn" | "bad" | "info" | "neutral">> = {
  TRAINING_OVERDUE: "bad", TRAINING_DUE_SOON: "warn", GAP_ALERT: "bad", COVER_CONFIRMED: "good", TRAINING_COMPLETED: "good", APPLICATION_APPROVED: "good", WELCOME: "info", SESSION_CONFIRMED: "info", HARVEST_CALLOUT: "info", SHIFT_REMINDER: "neutral", ABSENCE_CONFIRMED: "neutral", LAST_MINUTE_CALLOUT: "bad", GAP_ESCALATION: "bad", ROLES_CHANGED: "info", ROLE_CHANGE_REQUEST: "info",
};

export default async function OutboxPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requireAdmin();
  const { kind } = await searchParams;
  const [emails, kinds] = await Promise.all([
    db.email.findMany({ where: kind ? { kind } : undefined, orderBy: { createdAt: "desc" }, take: 100 }),
    db.email.groupBy({ by: ["kind"], _count: { _all: true } }),
  ]);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader eyebrow="Outbox" title="Every email and notification the system would send" description="Nothing leaves this demo. Each entry is exactly what the volunteer or coordinator would receive, rendered from the same templates production will use. Push notifications go to the volunteer app on their phone." />
      <div className="flex flex-wrap gap-1.5">
        <Link href="/admin/outbox" className={cn("flex h-10 items-center rounded-full border px-3 text-sm font-semibold", !kind ? "border-teal bg-teal-tint text-teal-deep" : "border-border bg-card text-muted-foreground hover:text-ink")}>All ({kinds.reduce((n, k) => n + k._count._all, 0)})</Link>
        {kinds.sort((a, b) => b._count._all - a._count._all).map((k) => (
          <Link key={k.kind} href={`/admin/outbox?kind=${k.kind}`} className={cn("flex h-10 items-center rounded-full border px-3 text-sm font-semibold", kind === k.kind ? "border-teal bg-teal-tint text-teal-deep" : "border-border bg-card text-muted-foreground hover:text-ink")}>
            {EMAIL_KIND_LABEL[k.kind as EmailKind]} ({k._count._all})
          </Link>
        ))}
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {emails.length === 0 && <li className="px-4 py-10 text-center text-muted-foreground">No emails of this kind yet.</li>}
        {emails.map((e) => (
          <li key={e.id}>
            <Link href={`/admin/outbox/${e.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-muted">
              <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg", e.channel === "PUSH" ? "bg-orange-tint text-orange-text" : "bg-muted text-muted-foreground")}>
                {e.channel === "PUSH" ? <Smartphone className="size-4" aria-label="Push notification" /> : <Mail className="size-4" aria-label="Email" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-bold text-ink">{e.subject}</span>
                  <Chip tone={TONE[e.kind as EmailKind] ?? "neutral"} size="sm">{EMAIL_KIND_LABEL[e.kind as EmailKind]}</Chip>
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
