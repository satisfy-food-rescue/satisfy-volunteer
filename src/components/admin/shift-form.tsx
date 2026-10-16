"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Megaphone, Save, Send } from "lucide-react";
import { saveShift, type ShiftFormInput } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OptionSelect } from "@/components/shared/option-select";
import { TIMES } from "@/components/admin/training-admin-controls";
import type { ShiftKind } from "@/lib/domain";

/** "all 6 volunteers in the harvest pool", "the 1 driver help volunteer". */
export function calloutAudience(holders: number, roleLabel: string, harvest: boolean) {
  const people = holders === 1 ? "volunteer" : "volunteers";
  if (harvest) return `${holders === 1 ? "the" : "all"} ${holders} ${people} in the harvest pool`;
  return `${holders === 1 ? "the" : "all"} ${holders} ${roleLabel.toLowerCase()} ${people}`;
}

export type ShiftFormTemplate = {
  id: string;
  name: string;
  kind: ShiftKind;
  startTime: string;
  endTime: string;
  capacity: number;
  needed: number;
  /** Where it happens when the shift does not say, e.g. the warehouse. */
  defaultLocation: string;
  /** Active volunteers who hold the role: who a callout reaches. */
  holders: number;
  roleLabel: string;
};

type Values = Omit<ShiftFormInput, "publish">;

/** Creates or edits a one-off shift. A new shift can be saved as a draft
 *  (coordinators only) or published straight away; publishing can send a
 *  callout to everyone who holds the role. */
export function ShiftForm({
  templates,
  initial,
  status,
  today,
}: {
  templates: ShiftFormTemplate[];
  initial: Values;
  /** Null for a new shift. */
  status: "DRAFT" | "SCHEDULED" | null;
  today: string;
}) {
  const [v, setV] = useState<Values>(initial);
  const [pending, start] = useTransition();
  const [submitting, setSubmitting] = useState<"draft" | "publish" | null>(null);
  const router = useRouter();
  const template = templates.find((t) => t.id === v.templateId) ?? templates[0];
  const harvest = template.kind === "HARVEST";
  const published = status === "SCHEDULED";

  const pickTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id)!;
    setV({ ...v, templateId: id, startTime: t.startTime, endTime: t.endTime, capacity: t.capacity, needed: t.needed, callout: t.kind === "HARVEST" });
  };

  const submit = (publish: boolean) =>
    start(async () => {
      setSubmitting(publish ? "publish" : "draft");
      const r = await saveShift({ ...v, publish });
      setSubmitting(null);
      if (r.ok) {
        toast.success(r.message);
        router.push(`/admin/roster/${r.id}`);
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <form
      className="grid max-w-3xl grid-cols-1 gap-5 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit(true);
      }}
    >
      {status === null ? (
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="sf-type">Shift type</Label>
          <OptionSelect id="sf-type" value={v.templateId} onValueChange={pickTemplate} options={templates.map((t) => ({ value: t.id, label: t.name }))} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground sm:col-span-2">
          Shift type: <span className="font-semibold text-ink">{template.name}</span>
        </p>
      )}
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="sf-title">{harvest ? "What's being picked" : "Title (optional)"}</Label>
        <Input id="sf-title" value={v.title} required={harvest} maxLength={80} onChange={(e) => setV({ ...v, title: e.target.value })} className="h-11 text-base" placeholder={harvest ? "For example, Apple picking at Loburn" : template.name} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sf-date">Date</Label>
        <DatePicker id="sf-date" min={today} value={v.date} onChange={(date) => setV({ ...v, date })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sf-start">Start</Label>
          <OptionSelect
            id="sf-start"
            value={v.startTime}
            onValueChange={(startTime) => setV({ ...v, startTime, endTime: v.endTime > startTime ? v.endTime : TIMES[Math.min(TIMES.length - 1, TIMES.findIndex((t) => t.value === startTime) + 8)].value })}
            options={TIMES}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sf-end">End</Label>
          <OptionSelect id="sf-end" value={v.endTime} onValueChange={(endTime) => setV({ ...v, endTime })} options={TIMES.filter((t) => t.value > v.startTime)} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="sf-loc">{harvest ? "Where" : "Location (optional)"}</Label>
        <Input id="sf-loc" value={v.location} required={harvest} maxLength={160} onChange={(e) => setV({ ...v, location: e.target.value })} className="h-11 text-base" placeholder={harvest ? "Orchard or address" : template.defaultLocation} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sf-needed">{harvest ? "Pickers needed" : "Minimum crew"}</Label>
        <Input id="sf-needed" type="number" min={1} max={60} value={v.needed} onChange={(e) => setV({ ...v, needed: Number(e.target.value) })} className="h-11 text-base" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sf-cap">Maximum</Label>
        <Input id="sf-cap" type="number" min={1} max={60} value={v.capacity} onChange={(e) => setV({ ...v, capacity: Number(e.target.value) })} className="h-11 text-base" />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="sf-notes">Details for volunteers</Label>
        <Textarea id="sf-notes" rows={4} maxLength={1000} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} aria-describedby="sf-notes-hint" className="text-base" placeholder={harvest ? "Parking, what to bring, who to meet, what's being picked and where it goes" : "Anything volunteers should know"} />
        <p id="sf-notes-hint" className="text-xs text-muted-foreground">Shown on the shift and included in the callout email.</p>
      </div>
      {!published && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-teal-tint-soft p-4 sm:col-span-2">
          <Checkbox className="mt-0.5 size-5" checked={v.callout} onCheckedChange={(c) => setV({ ...v, callout: c })} />
          <span className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink"><Megaphone className="size-4 text-teal" aria-hidden /> Send a callout when it&apos;s published</span>
            <span className="text-sm text-muted-foreground">
              Emails and notifies {calloutAudience(template.holders, template.roleLabel, harvest)}, with a Sign up button.
            </span>
          </span>
        </label>
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        {published ? (
          <Button type="submit" size="lg" className="h-11" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save changes
          </Button>
        ) : (
          <>
            <Button type="submit" size="lg" className="h-11" disabled={pending}>
              {submitting === "publish" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Publish{v.callout ? " and send callout" : ""}
            </Button>
            <Button type="button" variant="outline" size="lg" className="h-11" disabled={pending} onClick={() => submit(false)}>
              {submitting === "draft" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save as draft
            </Button>
          </>
        )}
        <Button type="button" variant="ghost" size="lg" className="h-11" disabled={pending} onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
