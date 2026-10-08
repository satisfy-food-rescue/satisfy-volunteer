import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock, MapPin, Users } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { formatInstant, formatInstantTime, addMonths, todayISO, formatDate } from "@/lib/dates";
import { fullName } from "@/lib/domain";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { Chip } from "@/components/shared/status-chip";
import { AttendanceToggle } from "@/components/admin/training-admin-controls";

export const metadata = { title: "Training session" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const s = await db.trainingSession.findUnique({ where: { id }, include: { module: true, rsvps: { include: { volunteer: true }, orderBy: { createdAt: "asc" } } } });
  if (!s) notFound();
  const going = s.rsvps.filter((r) => r.status === "GOING");
  const declined = s.rsvps.filter((r) => r.status === "DECLINED");
  const sessionISO = todayISO(s.startsAt);
  const nextDue = s.module.validityMonths ? addMonths(sessionISO, s.module.validityMonths) : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link href="/admin/training?tab=sessions" className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-ink"><ChevronLeft className="size-5" aria-hidden /> Sessions</Link>
      <header>
        <p className="eyebrow">Training session</p>
        <h1 className="mt-1 text-3xl text-ink">{s.module.name}</h1>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-ink-soft">
          <span className="inline-flex items-center gap-1.5 tabular"><Clock className="size-4 text-sky" aria-hidden />{formatInstant(s.startsAt)} to {formatInstantTime(s.endsAt)}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin className="size-4 text-sky" aria-hidden />{s.location}</span>
          <span className="inline-flex items-center gap-1.5 tabular"><Users className="size-4 text-sky" aria-hidden />{going.length} of {s.capacity} booked</span>
        </p>
        {s.notes && <p className="mt-2 text-sm text-muted-foreground">{s.notes}</p>}
      </header>

      <section className="rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-xl text-ink">RSVPs</h2>
          <p className="text-sm text-muted-foreground">Marking attended sets the completion date to {formatDate(sessionISO)}{nextDue ? ` and the next due date to ${formatDate(nextDue)}` : ""}.</p>
        </div>
        {going.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nobody booked yet.</p> : (
          <ul className="divide-y divide-border">
            {going.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <AvatarBadge person={r.volunteer} size="sm" />
                <Link href={`/admin/volunteers/${r.volunteerId}`} className="min-w-0 flex-1 truncate font-bold text-ink hover:underline">{fullName(r.volunteer)}</Link>
                {r.attendedAt && <Chip tone="good" size="sm">Record updated</Chip>}
                <AttendanceToggle rsvpId={r.id} attended={!!r.attendedAt} />
              </li>
            ))}
          </ul>
        )}
        {declined.length > 0 && <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Can&apos;t make it: {declined.map((r) => fullName(r.volunteer)).join(", ")}</p>}
      </section>
    </div>
  );
}
