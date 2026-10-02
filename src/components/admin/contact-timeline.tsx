import Link from "next/link";
import { CalendarOff, CalendarPlus, Hand, Mail, MessageSquareText, PhoneCall, Smartphone, Tags, UserPen } from "lucide-react";
import { dateToISO, formatDayRange, formatInstant } from "@/lib/dates";
import { ABSENCE_REASON_LABEL, CONTACT_LOG_LABEL, EMAIL_KIND_LABEL, type AbsenceReason, type ContactLogKind, type EmailKind } from "@/lib/domain";
import { cn } from "@/lib/utils";

type Entry = {
  id: string;
  at: Date;
  icon: React.ComponentType<{ className?: string }>;
  /** Coordinator contact stands out from automated messages. */
  personal: boolean;
  title: string;
  meta: string;
  detail?: string | null;
  href?: string;
};

const LOG_ICON: Record<ContactLogKind, Entry["icon"]> = {
  CALL: PhoneCall,
  NOTE: MessageSquareText,
  PROFILE_UPDATED: UserPen,
  ROLES_CHANGED: Tags,
  VISIT_BOOKED: CalendarPlus,
  ROLE_REQUEST: Hand,
};

export function ContactTimeline({
  emails,
  logs,
  absences,
  limit,
  showAllHref,
}: {
  emails: { id: string; channel: string; kind: string; subject: string; createdAt: Date }[];
  logs: { id: string; kind: string; summary: string; createdAt: Date; author: { firstName: string } | null; authorIsVolunteer: boolean }[];
  absences: { id: string; startDate: Date; endDate: Date; reason: string; note: string | null; createdAt: Date }[];
  limit: number | null;
  showAllHref: string;
}) {
  const entries: Entry[] = [
    ...emails.map((e) => ({
      id: e.id,
      at: e.createdAt,
      icon: e.channel === "PUSH" ? Smartphone : Mail,
      personal: false,
      title: e.subject,
      meta: `${e.channel === "PUSH" ? "Push notification" : "Email"} · ${EMAIL_KIND_LABEL[e.kind as EmailKind] ?? e.kind}`,
      href: `/admin/outbox/${e.id}`,
    })),
    ...logs.map((l) => ({
      id: l.id,
      at: l.createdAt,
      icon: LOG_ICON[l.kind as ContactLogKind] ?? MessageSquareText,
      personal: true,
      title: CONTACT_LOG_LABEL[l.kind as ContactLogKind] ?? l.kind,
      meta: l.authorIsVolunteer ? "From the volunteer app" : l.author ? `By ${l.author.firstName}` : "Coordinator",
      detail: l.summary,
    })),
    ...absences.map((a) => {
      const start = dateToISO(a.startDate);
      const end = dateToISO(a.endDate);
      return {
        id: a.id,
        at: a.createdAt,
        icon: CalendarOff,
        personal: false,
        title: `Marked away ${formatDayRange(start, end)}`,
        meta: `Absence · ${ABSENCE_REASON_LABEL[a.reason as AbsenceReason]}`,
        detail: a.note,
      };
    }),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  if (entries.length === 0) {
    return <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">No contact yet.</p>;
  }
  const shown = limit ? entries.slice(0, limit) : entries;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <ol className="px-4 py-2">
        {shown.map((e, i) => {
          const body = (
            <>
              <span className="flex items-baseline justify-between gap-3">
                <span className={cn("min-w-0 font-semibold text-ink", e.href && "group-hover:underline")}>{e.title}</span>
                <time dateTime={e.at.toISOString()} className="shrink-0 text-xs text-muted-foreground tabular">{formatInstant(e.at)}</time>
              </span>
              <span className="block text-xs text-muted-foreground">{e.meta}</span>
              {e.detail && <span className="mt-1 block whitespace-pre-line text-sm text-ink-soft">{e.detail}</span>}
            </>
          );
          return (
            <li key={e.id} className="relative flex gap-3 py-2.5">
              {/* Rail joining each entry to the next. */}
              {i < shown.length - 1 && <span className="absolute left-[0.95rem] top-11 bottom-0 w-px bg-border" aria-hidden />}
              <span className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-full", e.personal ? "bg-green-tint text-green-deep" : "bg-muted text-muted-foreground")}>
                <e.icon className="size-4" aria-hidden />
              </span>
              {e.href ? (
                <Link href={e.href} className="group min-w-0 flex-1">{body}</Link>
              ) : (
                <div className="min-w-0 flex-1">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
      {limit && entries.length > limit && (
        <Link href={showAllHref} scroll={false} className="block border-t border-border px-4 py-2.5 text-sm font-semibold text-green-text hover:bg-muted">
          Show all {entries.length}
        </Link>
      )}
    </div>
  );
}
