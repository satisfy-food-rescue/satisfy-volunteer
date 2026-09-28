import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { addDays, monthEnd, monthStart, todayISO, weekMonday } from "@/lib/dates";
import { shiftsBetween } from "@/lib/roster";
import { PageHeader } from "@/components/shared/page-header";
import { MonthView, RosterNav, WeekView } from "@/components/admin/roster-calendar";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Roster" };

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  await requireAdmin();
  const today = todayISO();
  const sp = await searchParams;
  const view = sp.view === "month" ? "month" : "week";
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const anchor = view === "week" ? weekMonday(date) : monthStart(date);
  const [from, to] = view === "week" ? [anchor, addDays(anchor, 4)] : [addDays(monthStart(anchor), -6), addDays(monthEnd(anchor), 6)];
  const shifts = await shiftsBetween(from, to);
  const gaps = shifts.filter((s) => s.isGap && s.iso >= today);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        eyebrow="Roster"
        title={view === "week" ? "This week's shifts" : "Month at a glance"}
        description={gaps.length ? `${gaps.length} shift${gaps.length === 1 ? " in view still needs" : "s in view still need"} cover.` : "Every shift in view has its minimum crew."}
        actions={<Button size="lg" className="h-11" render={<Link href="/admin/roster/bulk" />}><CalendarPlus className="size-4" /> Bulk schedule</Button>}
      />
      <RosterNav view={view} anchor={anchor} today={today} />
      {view === "week" ? <WeekView monday={anchor} shifts={shifts} today={today} /> : <MonthView anchor={anchor} shifts={shifts} today={today} />}
    </div>
  );
}
