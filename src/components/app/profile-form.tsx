"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { updateProfile } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

/** Floated, the legend sits inside the card as its heading instead of cutting
 *  a notch in the border. The fieldset is a flex column, so nothing needs to
 *  clear the float. Matches the "My roles" heading above the form. */
const LEGEND = "float-left w-full font-display text-xl leading-tight font-bold tracking-[-0.02em] text-ink";

type Values = { phone: string; suburb: string; emergencyName: string; emergencyPhone: string; availabilityNote: string; lastMinuteOk: boolean };

export function ProfileForm({ initial, email }: { initial: Values; email: string }) {
  const [v, setV] = useState(initial);
  const [pending, run] = useTransition();
  const router = useRouter();
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const r = await updateProfile(v);
          if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
        });
      }}
    >
      <fieldset className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
        <legend className={LEGEND}>Contact</legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-base">Email</Label>
          <Input id="email" value={email} readOnly className="h-12 bg-muted text-base" />
          <p className="text-xs text-muted-foreground">This is the email you sign in with. Ask the coordinator to change it.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone" className="text-base">Mobile</Label>
          <Input id="phone" type="tel" autoComplete="tel" value={v.phone} onChange={set("phone")} className="h-12 text-base" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="suburb" className="text-base">Suburb or town</Label>
          <Input id="suburb" autoComplete="address-level2" value={v.suburb} onChange={set("suburb")} className="h-12 text-base" />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
        <legend className={LEGEND}>Emergency contact</legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ec-name" className="text-base">Name and relationship</Label>
          <Input id="ec-name" value={v.emergencyName} onChange={set("emergencyName")} className="h-12 text-base" placeholder="e.g. Sam, partner" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ec-phone" className="text-base">Phone</Label>
          <Input id="ec-phone" type="tel" value={v.emergencyPhone} onChange={set("emergencyPhone")} className="h-12 text-base" />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
        <legend className={LEGEND}>Availability</legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="avail" className="text-base">When can you usually help?</Label>
          <Textarea id="avail" rows={3} value={v.availabilityNote} onChange={set("availabilityNote")} className="text-base" placeholder="e.g. Most weekday mornings, not Fridays" />
        </div>
        <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block font-semibold text-ink">Send me last-minute cover requests</span>
            <span className="block text-sm text-muted-foreground">Get a notification when a shift you can do needs cover at short notice.</span>
          </span>
          <Switch
            checked={v.lastMinuteOk}
            onCheckedChange={(c) => setV({ ...v, lastMinuteOk: c })}
            // The default switch is 18 by 32 pixels: too small to read or hit
            // comfortably on a phone. The whole label row is the tap target.
            className="data-[size=default]:h-7 data-[size=default]:w-12 [&_[data-slot=switch-thumb]]:size-6"
          />
        </label>
      </fieldset>

      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Save className="size-5" aria-hidden />}
        Save changes
      </Button>
    </form>
  );
}
