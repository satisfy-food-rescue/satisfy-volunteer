import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { shiftById, shiftFormTemplates } from "@/lib/roster";
import { PageHeader } from "@/components/shared/page-header";
import { ShiftForm } from "@/components/admin/shift-form";

export const metadata = { title: "Edit shift" };

export default async function EditShiftPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const view = await shiftById(id, { drafts: true });
  if (!view) notFound();
  const today = todayISO();
  const s = view.shift;
  const editable = s.status !== "CANCELLED" && view.iso >= today;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Link href={`/admin/roster/${id}`} className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-ink">
        <ChevronLeft className="size-5" aria-hidden /> {view.name}
      </Link>
      <PageHeader
        eyebrow={view.isDraft ? "Draft" : "Edit shift"}
        title={`Edit ${view.name}`}
        description={
          view.isDraft
            ? "Only coordinators can see this draft. Publish it when the details are set."
            : view.confirmedCount > 0
              ? `${view.confirmedCount} ${view.confirmedCount === 1 ? "person is" : "people are"} booked on it. Saving does not tell them; use Message crew on the shift afterwards.`
              : "Volunteers can see this shift. Changes show straight away."
        }
      />
      {editable ? (
        <ShiftForm
          templates={(await shiftFormTemplates()).filter((t) => t.id === s.templateId)}
          status={view.isDraft ? "DRAFT" : "SCHEDULED"}
          today={today}
          initial={{ id: s.id, templateId: s.templateId, date: view.iso, startTime: s.startTime, endTime: s.endTime, title: s.title ?? "", location: s.location ?? "", notes: s.notes ?? "", capacity: s.capacity, needed: s.needed, callout: view.kind === "HARVEST" }}
        />
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center text-muted-foreground">
          This shift is {s.status === "CANCELLED" ? "cancelled" : "in the past"}, so it can no longer be edited.
        </p>
      )}
    </div>
  );
}
