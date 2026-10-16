import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { shiftFormTemplates } from "@/lib/roster";
import { PageHeader } from "@/components/shared/page-header";
import { ShiftForm } from "@/components/admin/shift-form";

export const metadata = { title: "New shift" };

export default async function NewShiftPage({ searchParams }: { searchParams: Promise<{ kind?: string; date?: string; from?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = todayISO();
  const templates = await shiftFormTemplates();
  const t = templates.find((x) => x.kind === sp.kind) ?? templates[0];
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date >= today ? sp.date : today;
  const harvest = t.kind === "HARVEST";
  const back = sp.from === "harvests" ? { href: "/admin/harvests", label: "Harvests" } : { href: "/admin/roster", label: "Roster" };
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Link href={back.href} className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-ink">
        <ChevronLeft className="size-5" aria-hidden /> {back.label}
      </Link>
      <PageHeader
        eyebrow="New shift"
        title={harvest ? "Plan a harvest" : "Add a one-off shift"}
        description="Save it as a draft while details firm up; only coordinators see drafts. Publishing makes it bookable and can send a callout to everyone who can do it."
      />
      <ShiftForm
        templates={templates}
        status={null}
        today={today}
        initial={{ templateId: t.id, date, startTime: t.startTime, endTime: t.endTime, title: "", location: "", notes: "", capacity: t.capacity, needed: t.needed, callout: harvest }}
      />
    </div>
  );
}
