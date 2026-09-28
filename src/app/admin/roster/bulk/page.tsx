import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { dateToISO, formatDate, todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { BulkScheduler } from "@/components/admin/bulk-scheduler";

export const metadata = { title: "Bulk schedule" };

export default async function BulkPage() {
  await requireAdmin();
  const templates = await db.shiftTemplate.findMany({ where: { active: true }, include: { regularSlots: true }, orderBy: { order: "asc" } });
  const latest = await db.shift.findFirst({ orderBy: { date: "desc" }, select: { date: true } });
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Link href="/admin/roster" className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-ink"><ChevronLeft className="size-5" aria-hidden /> Roster</Link>
      <PageHeader
        eyebrow="Bulk schedule"
        title="Roll out shifts across a date range"
        description={`Pick templates, dates and weekdays, preview everything that will be created, then confirm. Regular volunteers land on their usual day automatically. Shifts currently exist up to ${latest ? formatDate(dateToISO(latest.date)) : "today"}.`}
      />
      <BulkScheduler today={todayISO()} templates={templates.map((t) => ({ id: t.id, name: t.name, startTime: t.startTime, endTime: t.endTime, capacity: t.capacity, needed: t.needed, weekdays: t.weekdays, regulars: t.regularSlots.length }))} />
    </div>
  );
}
