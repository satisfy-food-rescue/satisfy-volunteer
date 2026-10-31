import Link from "next/link";
import { AlertTriangle, ArrowRight, ChevronDown, Mail, Smartphone, Users } from "lucide-react";
import type { Email, Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { isDemo } from "@/lib/env";
import { formatInstant } from "@/lib/dates";
import { EMAIL_KIND_LABEL, type DeliveryStatus, type EmailKind } from "@/lib/domain";
import { PageHeader } from "@/components/shared/page-header";
import { Chip, DeliveryChip } from "@/components/shared/status-chip";
import { OutboxFilter } from "@/components/admin/outbox-filter";
import { cn } from "@/lib/utils";

export const metadata = { title: "Outbox" };

// Orange is for anything about cover; red only for training that has lapsed.
const TONE: Record<EmailKind, "good" | "warn" | "bad" | "info" | "neutral"> = {
  TRAINING_OVERDUE: "bad", TRAINING_OVERDUE_COORDINATOR: "bad", TRAINING_DUE_SOON: "warn", GAP_ALERT: "warn", COVER_CONFIRMED: "good", TRAINING_COMPLETED: "good", APPLICATION_APPROVED: "good", ACCOUNT_INVITE: "info", PASSWORD_RESET: "info", SESSION_CONFIRMED: "info", HARVEST_CALLOUT: "info", SHIFT_REMINDER: "neutral", ABSENCE_CONFIRMED: "neutral", LAST_MINUTE_CALLOUT: "warn", GAP_ESCALATION: "warn", ROLES_CHANGED: "info", ROLE_CHANGE_REQUEST: "info", SHIFT_CANCELLED: "warn", SHIFT_ADDED: "good", SHIFT_PUBLISHED: "info", ANNOUNCEMENT: "info", ADMIN_ACCESS: "info", APPLICATION_RECEIVED: "neutral", APPLICATION_NEW: "info", ALREADY_REGISTERED: "neutral", ACCOUNT_DELETED: "neutral",
};

const FAILED = "failed";

/** Copies of one message sent to many people at once (a callout, an
 *  announcement, a reminder for a shift's crew) show as a single row. A send
 *  is known by its dedupe ref without the recipient ("callout:<shift>"), else
 *  by its subject and link, and its copies are queued within minutes. */
const SAME_SEND_MS = 5 * 60_000;

function sendKey(e: Email) {
  const parts = e.ref?.split(":") ?? [];
  if (parts.length >= 3) return `${e.kind}|${parts.slice(0, -1).join(":")}`;
  return `${e.kind}|${e.subject}|${e.ctaHref ?? ""}`;
}

function groupSends(emails: Email[]): Email[][] {
  const groups: Email[][] = [];
  const open = new Map<string, Email[]>();
  for (const e of emails) {
    const key = sendKey(e);
    const group = open.get(key);
    if (group && group[0].createdAt.getTime() - e.createdAt.getTime() < SAME_SEND_MS) {
      group.push(e);
    } else {
      open.set(key, [e]);
      groups.push(open.get(key)!);
    }
  }
  return groups;
}

/** One entry per person, with each copy they were sent (push, email or both). */
function byRecipient(emails: Email[]) {
  const people = new Map<string, Email[]>();
  for (const e of emails) {
    const key = e.volunteerId ?? e.applicationId ?? e.toEmail;
    people.set(key, [...(people.get(key) ?? []), e]);
  }
  return [...people.values()];
}

/** The status a group shows: any failure first, then anything still waiting. */
function groupStatus(emails: Email[]): DeliveryStatus {
  const order: DeliveryStatus[] = ["FAILED", "PENDING", "SENT", "CAPTURED"];
  return order.find((s) => emails.some((e) => e.status === s)) ?? "SENT";
}

function ChannelTile({ channel }: { channel: Email["channel"] | "MANY" }) {
  return (
    <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg", channel === "PUSH" ? "bg-orange-tint text-orange-text" : channel === "MANY" ? "bg-teal-tint text-teal-deep" : "bg-muted text-muted-foreground")}>
      {channel === "PUSH" ? <Smartphone className="size-4" role="img" aria-label="Push notification" /> : channel === "MANY" ? <Users className="size-4" aria-hidden /> : <Mail className="size-4" role="img" aria-label="Email" />}
    </span>
  );
}

const recipient = (e: Email) => (e.channel === "PUSH" ? `${e.toName}'s phone` : <>{e.toName} &lt;{e.toEmail}&gt;</>);

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
  const total = kinds.reduce((n, k) => n + k._count._all, 0);
  const options = [
    { value: "all", label: `All messages (${total})` },
    ...(failed > 0 ? [{ value: FAILED, label: `Not delivered (${failed})` }] : []),
    // A kind with nothing sent yet is still listed while it is the filter.
    ...[...kinds, ...(kind && !kinds.some((k) => k.kind === kind) ? [{ kind, _count: { _all: 0 } }] : [])]
      .map((k) => ({ value: k.kind, label: `${EMAIL_KIND_LABEL[k.kind]} (${k._count._all})` }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];
  const groups = groupSends(emails);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        eyebrow="Messages"
        title="Outbox"
        description={
          demo
            ? "Every email and notification the system would send. Nothing leaves this demo: each one is exactly what the volunteer or coordinator would receive, from the same templates production uses."
            : "Every email and notification the system has sent, newest first. Push notifications go to the volunteer app; anyone not signed in to it on a phone gets an email instead. Anything that could not be delivered is retried automatically for two days."
        }
      />
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <OutboxFilter value={showFailed ? FAILED : (kind ?? "all")} options={options} />
          {failed > 0 && !showFailed && (
            <Link href={`/admin/outbox?kind=${FAILED}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-status-bad hover:bg-status-bad-bg">
              <AlertTriangle className="size-4" aria-hidden />
              {failed} not delivered
            </Link>
          )}
          <p className="ml-auto text-sm text-muted-foreground" aria-live="polite">
            {emails.length} {emails.length === 1 ? "message" : "messages"}{groups.length < emails.length ? `, ${groups.length} sends` : ""}{emails.length === 100 ? " (the latest 100)" : ""}
          </p>
        </div>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {emails.length === 0 && <li className="px-4 py-10 text-center text-muted-foreground">{kind ? `No ${EMAIL_KIND_LABEL[kind].toLowerCase()} messages yet.` : "Nothing here yet."}</li>}
          {groups.map((group) => {
            const e = group[0];
            if (group.length === 1) {
              return (
                <li key={e.id}>
                  <Link href={`/admin/outbox/${e.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-muted">
                    <ChannelTile channel={e.channel} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="min-w-0 truncate font-bold text-ink">{e.subject}</span>
                        <Chip tone={TONE[e.kind]} size="sm">{EMAIL_KIND_LABEL[e.kind]}</Chip>
                        {!demo && <DeliveryChip status={e.status} />}
                      </span>
                      <span className="block truncate text-sm text-ink-soft">{e.preview}</span>
                      <span className="block text-xs text-muted-foreground">To {recipient(e)} · {formatInstant(e.createdAt)}</span>
                    </span>
                    <ArrowRight className="mt-2 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            }
            const lead = group.find((x) => x.channel === "EMAIL") ?? e;
            const people = byRecipient(group);
            const noun = group.every((x) => x.volunteerId) ? "volunteers" : "people";
            const push = people.filter((p) => p.some((x) => x.channel === "PUSH")).length;
            const email = people.filter((p) => p.some((x) => x.channel === "EMAIL")).length;
            const channels = push === 0 ? "by email" : email === 0 ? "by push" : push === people.length && email === people.length ? "by push and email" : `${push} by push, ${email} by email`;
            return (
              <li key={e.id}>
                <details className="group/send">
                  <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 hover:bg-muted [&::-webkit-details-marker]:hidden">
                    <ChannelTile channel="MANY" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="min-w-0 truncate font-bold text-ink">{lead.subject}</span>
                        <Chip tone={TONE[e.kind]} size="sm">{EMAIL_KIND_LABEL[e.kind]} · {people.length} {noun}</Chip>
                        {!demo && <DeliveryChip status={groupStatus(group)} />}
                      </span>
                      <span className="block truncate text-sm text-ink-soft">{lead.preview}</span>
                      <span className="block text-xs text-muted-foreground">To {people.length} {noun}, {channels} · {formatInstant(e.createdAt)}</span>
                    </span>
                    <span className="mt-1.5 inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-teal">
                      <span className="group-open/send:hidden">Show</span>
                      <span className="hidden group-open/send:inline">Hide</span>
                      <span className="sr-only"> recipients</span>
                      <ChevronDown className="size-4 transition-transform group-open/send:rotate-180" aria-hidden />
                    </span>
                  </summary>
                  <ul className="mx-4 mb-3 grid gap-x-6 border-l-2 border-teal-tint pl-2 @2xl/admin:ml-16 @5xl/admin:grid-cols-2">
                    {people.map((copies) => (
                      <li key={copies[0].id} className="flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1 text-sm">
                        <span className="min-w-0 flex-1 truncate text-ink">{copies[0].toName}</span>
                        {copies.toSorted((a, b) => b.channel.localeCompare(a.channel)).map((x) => (
                          <Link key={x.id} href={`/admin/outbox/${x.id}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs font-semibold text-ink-soft hover:border-teal/60 hover:text-ink">
                            {x.channel === "PUSH" ? <Smartphone className="size-3.5 text-orange-text" aria-hidden /> : <Mail className="size-3.5 text-muted-foreground" aria-hidden />}
                            {x.channel === "PUSH" ? "Push" : "Email"}
                            <span className="sr-only"> to {x.toName}</span>
                            {!demo && x.status === "FAILED" && <AlertTriangle className="size-3.5 text-status-bad" role="img" aria-label="Not delivered" />}
                          </Link>
                        ))}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
