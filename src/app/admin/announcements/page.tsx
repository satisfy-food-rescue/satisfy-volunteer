import Link from "next/link";
import { Mail, Smartphone } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { addDays, formatDay, formatInstant, formatTimeRange, isoToDate, todayISO } from "@/lib/dates";
import { fullName } from "@/lib/domain";
import { decorateShift, shiftInclude } from "@/lib/roster";
import { PageHeader } from "@/components/shared/page-header";
import { AnnouncementForm } from "@/components/admin/announcement-form";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ shift?: string }> }) {
  const admin = await requireAdmin();
  const { shift } = await searchParams;
  const today = todayISO();
  const [shifts, history] = await Promise.all([
    // Shifts with a crew to message: the next month, plus the one asked for.
    db.shift.findMany({
      where: {
        status: "SCHEDULED",
        assignments: { some: { status: "CONFIRMED" } },
        OR: [{ date: { gte: isoToDate(today), lte: isoToDate(addDays(today, 31)) } }, ...(shift ? [{ id: shift }] : [])],
      },
      include: shiftInclude,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    db.announcement.findMany({ include: { author: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const options = shifts.map(decorateShift).map((v) => ({ id: v.shift.id, label: `${formatDay(v.iso)}, ${formatTimeRange(v.shift.startTime, v.shift.endTime)}: ${v.name} (${v.confirmedCount})` }));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        eyebrow="People"
        title="Announcements"
        description="Send news or a change of plans to everyone, a group of roles, or the crew of one shift. It goes by email, and as a push notification to phones with the app."
      />
      <AnnouncementForm shifts={options} initialShiftId={shift && options.some((o) => o.id === shift) ? shift : null} from={admin.firstName} />

      <section className="flex flex-col gap-3" aria-labelledby="sent-h">
        <h2 id="sent-h" className="text-2xl text-ink">Sent</h2>
        {history.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center text-muted-foreground">Nothing sent yet.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {history.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-tint-soft text-teal" aria-hidden>
                  {a.push ? <Smartphone className="size-4" /> : <Mail className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-ink">{a.subject}</span>
                  <span className="block text-sm text-ink-soft">
                    {a.audienceLabel} · <span className="tabular">{a.recipientCount}</span> {a.recipientCount === 1 ? "volunteer" : "volunteers"} · {a.push ? "email and push" : "email"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatInstant(a.createdAt)}
                    {a.author && ` by ${fullName(a.author)}`}
                    {a.shiftId && (
                      <>
                        {" · "}
                        <Link href={`/admin/roster/${a.shiftId}`} className="font-semibold text-teal hover:underline">Open the shift</Link>
                      </>
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
