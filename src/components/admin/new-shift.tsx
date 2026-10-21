import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { todayISO } from "@/lib/dates";
import { isAdHocKind, type ShiftKind } from "@/lib/domain";
import { shiftFormTemplates } from "@/lib/roster";
import { PageHeader } from "@/components/shared/page-header";
import { ShiftForm } from "@/components/admin/shift-form";

/** The new shift form, opened from the Roster or, for a harvest, from
 *  Harvests. Each has its own route so the sidebar shows where you came from. */
export async function NewShift({ kind, date: requested, from }: { kind?: string; date?: string; from: "roster" | "harvests" }) {
  const today = todayISO();
  const templates = await shiftFormTemplates();
  // Without a kind (the roster's New shift button) start on a regular shift
  // type; harvests have their own button on the Harvests page.
  const t = templates.find((x) => x.kind === (kind as ShiftKind)) ?? templates.find((x) => !isAdHocKind(x.kind)) ?? templates[0];
  const date = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested >= today ? requested : today;
  const harvest = t.kind === "HARVEST";
  const back = from === "harvests" ? { href: "/admin/harvests", label: "Harvests" } : { href: "/admin/roster", label: "Roster" };
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <Link href={back.href} className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-ink">
        <ChevronLeft className="size-5" aria-hidden /> {back.label}
      </Link>
      <PageHeader
        eyebrow="Roster"
        title={harvest ? "Plan a harvest" : "New shift"}
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
