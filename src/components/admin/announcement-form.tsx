"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Send, Smartphone, Users } from "lucide-react";
import { previewAudience, sendAnnouncementAction } from "@/app/admin/actions";
import type { AudienceInput } from "@/lib/announcements";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OptionSelect } from "@/components/shared/option-select";
import { ROLE_LABEL, VOLUNTEER_ROLES, type VolunteerRole } from "@/lib/domain";
import { cn } from "@/lib/utils";

export type ShiftOption = { id: string; label: string };

type Audience = AudienceInput["audience"];

const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  { value: "ALL", label: "Everyone", hint: "All active volunteers" },
  { value: "ROLES", label: "By role", hint: "For example, the harvest pool" },
  { value: "SHIFT", label: "A shift's crew", hint: "Everyone booked on one shift" },
];

const pill = (on: boolean) =>
  cn(
    "flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 font-display text-sm font-semibold transition-colors has-focus-visible:outline-3 has-focus-visible:outline-ring",
    on ? "border-teal bg-teal-tint-soft text-teal-deep" : "border-border bg-card text-muted-foreground hover:text-ink",
  );

/** Compose and send an announcement. The recipient count updates as the
 *  audience changes, and sending asks once more with the number. */
export function AnnouncementForm({ shifts, initialShiftId, from }: { shifts: ShiftOption[]; initialShiftId: string | null; from: string }) {
  const [audience, setAudience] = useState<Audience>(initialShiftId ? "SHIFT" : "ALL");
  const [roles, setRoles] = useState<VolunteerRole[]>(["HARVEST"]);
  const [shiftId, setShiftId] = useState(initialShiftId ?? shifts[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [push, setPush] = useState(true);
  // The preview is stored with the audience it was counted for, so a result
  // for an earlier audience never shows (or reaches the confirm dialog) after
  // the audience changes.
  const [preview, setPreview] = useState<{ key: string; result: { count: number; names: string[]; label: string } | { error: string } } | null>(null);
  // What the confirm dialog shows, fixed when it opens so clearing the form
  // after sending does not blank the dialog while it animates closed.
  const [confirming, setConfirming] = useState<{ subject: string; count: number; push: boolean } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const target: AudienceInput | null =
    audience === "ALL" ? { audience } : audience === "ROLES" ? (roles.length ? { audience, roles } : null) : shiftId ? { audience, shiftId } : null;
  const targetKey = JSON.stringify(target);

  useEffect(() => {
    let live = true;
    const t: AudienceInput | null = JSON.parse(targetKey);
    if (!t) return;
    previewAudience(t).then((r) => {
      if (live) setPreview({ key: targetKey, result: r.ok ? r : { error: r.error } });
    });
    return () => {
      live = false;
    };
  }, [targetKey]);

  const reach = target && preview?.key === targetKey ? preview.result : null;
  const count = reach && "count" in reach ? reach.count : 0;
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  const send = () =>
    start(async () => {
      if (!target) return;
      const r = await sendAnnouncementAction({ subject, body, push, target });
      if (r.ok) {
        toast.success(r.message);
        setConfirming(null);
        setSubject("");
        setBody("");
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <div className="grid grid-cols-1 gap-6 @4xl/admin:grid-cols-5">
      <form
        className="@container flex min-w-0 flex-col gap-5 rounded-2xl border border-border bg-card p-5 @4xl/admin:col-span-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!target) return toast.error(audience === "ROLES" ? "Pick at least one role." : "Pick a shift.");
          if (!reach) return;
          if (count === 0) return toast.error("Nobody matches that audience yet.");
          setConfirming({ subject, count, push });
        }}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Who it goes to</legend>
          <div className="grid gap-2 @lg:grid-cols-3">
            {AUDIENCES.filter((a) => a.value !== "SHIFT" || shifts.length > 0).map((a) => (
              <label key={a.value} className={cn("flex cursor-pointer flex-col rounded-xl border p-3 transition-colors has-focus-visible:outline-3 has-focus-visible:outline-ring", audience === a.value ? "border-teal bg-teal-tint-soft" : "border-border hover:border-teal/50")}>
                <input type="radio" name="audience" className="sr-only" checked={audience === a.value} onChange={() => setAudience(a.value)} />
                <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
                  {audience === a.value && <Check className="size-4 text-teal" aria-hidden />}
                  {a.label}
                </span>
                <span className="text-xs text-muted-foreground">{a.hint}</span>
              </label>
            ))}
          </div>
          {audience === "ROLES" && (
            <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="Roles">
              {VOLUNTEER_ROLES.map((r) => {
                const on = roles.includes(r);
                return (
                  <label key={r} className={cn(pill(on), "h-10")}>
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => setRoles(on ? roles.filter((x) => x !== r) : [...roles, r])} />
                    {on && <Check className="size-4 text-teal" aria-hidden />}
                    {r === "HARVEST" ? "Harvest pool" : ROLE_LABEL[r]}
                  </label>
                );
              })}
            </div>
          )}
          {audience === "SHIFT" && (
            <div className="mt-1 flex flex-col gap-1.5">
              <Label htmlFor="an-shift" className="sr-only">Shift</Label>
              <OptionSelect id="an-shift" value={shiftId} onValueChange={setShiftId} options={shifts.map((s) => ({ value: s.id, label: s.label }))} />
            </div>
          )}
          <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-soft" aria-live="polite">
            <Users className="mt-0.5 size-4 shrink-0 text-sky" aria-hidden />
            {!target ? (
              audience === "ROLES" ? "Pick at least one role." : "Pick a shift."
            ) : !reach ? (
              "Counting..."
            ) : "error" in reach ? (
              reach.error
            ) : (
              <span>
                <span className="font-bold text-ink tabular">{reach.count} {reach.count === 1 ? "volunteer" : "volunteers"}</span>
                {reach.names.length > 0 && `: ${reach.names.join(", ")}${reach.count > reach.names.length ? ` and ${reach.count - reach.names.length} more` : ""}`}
              </span>
            )}
          </p>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="an-subject">Subject</Label>
          <Input id="an-subject" required minLength={3} maxLength={120} value={subject} onChange={(e) => setSubject(e.target.value)} className="h-11 text-base" placeholder="For example, Saturday's harvest moves to 10am" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="an-body">Message</Label>
          <Textarea id="an-body" required minLength={10} maxLength={5000} rows={8} value={body} onChange={(e) => setBody(e.target.value)} aria-describedby="an-body-hint" className="min-h-48 text-base leading-relaxed" />
          <p id="an-body-hint" className="text-xs text-muted-foreground">Leave a blank line between paragraphs. &ldquo;Kia ora&rdquo; and your sign-off are added for you.</p>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
          <Checkbox className="mt-0.5 size-5" checked={push} onCheckedChange={setPush} />
          <span className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink"><Smartphone className="size-4 text-sky" aria-hidden /> Also send a push notification</span>
            <span className="text-xs text-muted-foreground">Lands on the phones of volunteers using the app. Best for anything time-sensitive.</span>
          </span>
        </label>
        <Button type="submit" size="lg" className="self-start" disabled={pending || !reach || count === 0}>
          <Send className="size-4" /> Review and send
        </Button>
      </form>

      <aside className="flex flex-col gap-2 @4xl/admin:col-span-2" aria-labelledby="an-preview-h">
        <h2 id="an-preview-h" className="font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">Email preview</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border bg-muted/50 px-4 py-3">
            <p className={cn("font-bold", subject ? "text-ink" : "text-muted-foreground")}>{subject || "Subject"}</p>
            <p className="text-xs text-muted-foreground">From the Satisfy volunteer team</p>
          </div>
          <div className="flex flex-col gap-3 px-4 py-4 text-sm leading-relaxed text-ink">
            <p>Kia ora <span className="rounded bg-muted px-1 text-muted-foreground">first name</span>,</p>
            {paragraphs.length ? paragraphs.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>) : <p className="text-muted-foreground">Your message appears here.</p>}
            <p className="whitespace-pre-line">{`Ngā mihi nui,\n${from} and the Satisfy volunteer team`}</p>
          </div>
        </div>
      </aside>

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-ink">Send to {confirming?.count} {confirming?.count === 1 ? "volunteer" : "volunteers"}?</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-ink">{confirming?.subject}</span> goes out by email{confirming?.push ? " and as a push notification" : ""} straight away. It shows on each volunteer&apos;s communication history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={pending} onClick={() => setConfirming(null)}>Keep editing</Button>
            <Button disabled={pending} onClick={send}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" />} Send now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
