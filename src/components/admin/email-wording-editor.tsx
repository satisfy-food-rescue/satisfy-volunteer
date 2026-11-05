"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, RotateCcw, Undo2 } from "lucide-react";
import { resetEmailWording, saveEmailWording } from "@/app/admin/email-actions";
import { renderText, wordingProblems, type TemplateSpec, type TemplateText, type TextField } from "@/lib/email-templates";
import { MessagePreview } from "@/components/admin/message-preview";
import { FieldError } from "@/components/admin/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Spec = Pick<TemplateSpec, "key" | "name" | "channel" | "placeholders" | "sample" | "subject" | "preview" | "body" | "ctaLabel">;

/** Edits the wording of one automatic message, with a live preview filled
 *  with example values. Placeholders are inserted where the cursor was. */
export function EmailWordingEditor({ spec, saved, custom, footerNote, signInLink }: { spec: Spec; saved: TemplateText; custom: boolean; footerNote: string; signInLink: boolean }) {
  const [text, setText] = useState<TemplateText>(saved);
  const [errors, setErrors] = useState<Partial<Record<TextField, string>>>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const push = spec.channel === "PUSH";
  const fieldRefs = useRef<Partial<Record<TextField, HTMLInputElement | HTMLTextAreaElement | null>>>({});
  // Where a clicked placeholder goes: the field last focused.
  const [lastField, setLastField] = useState<TextField>("body");
  const changed = text.subject !== saved.subject || text.preview !== saved.preview || text.body !== saved.body || (text.ctaLabel ?? "") !== (saved.ctaLabel ?? "");
  // Shown as you type, so a mistyped placeholder is caught before saving.
  const live = wordingProblems(spec, text) ?? {};
  const shown = { ...live, ...errors };
  const rendered = renderText(text, spec.sample);

  const set = (field: TextField, value: string) => {
    setText((t) => ({ ...t, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const insert = (name: string) => {
    const field = lastField;
    const el = fieldRefs.current[field];
    const value = text[field] ?? "";
    const token = `{${name}}`;
    const startAt = el?.selectionStart ?? value.length;
    const endAt = el?.selectionEnd ?? value.length;
    set(field, value.slice(0, startAt) + token + value.slice(endAt));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(startAt + token.length, startAt + token.length);
    });
  };

  const save = () =>
    start(async () => {
      const r = await saveEmailWording({ key: spec.key, subject: text.subject, preview: text.preview, body: text.body, ctaLabel: text.ctaLabel ?? "" });
      if (r.ok) {
        toast.success(r.message);
        setErrors({});
        router.refresh();
      } else {
        setErrors(r.fields ?? {});
        toast.error(r.error);
      }
    });

  const reset = () =>
    start(async () => {
      const r = await resetEmailWording(spec.key);
      if (r.ok) {
        toast.success(r.message);
        setText({ subject: spec.subject, preview: spec.preview, body: spec.body, ctaLabel: spec.ctaLabel });
        setErrors({});
        router.refresh();
      } else toast.error(r.error);
    });

  const props = (field: TextField) => ({
    id: `w-${field}`,
    value: text[field] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(field, e.target.value),
    onFocus: () => setLastField(field),
    "aria-invalid": shown[field] ? true : undefined,
    "aria-describedby": shown[field] ? `w-${field}-error` : `w-${field}-hint`,
  });

  return (
    <div className="grid items-start gap-6 @4xl/admin:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="w-subject">{push ? "Title" : "Subject"}</Label>
          <Input ref={(el) => { fieldRefs.current.subject = el; }} {...props("subject")} className="h-11 text-base" />
          {shown.subject ? <FieldError id="w-subject-error">{shown.subject}</FieldError> : <p id="w-subject-hint" className="sr-only">{push ? "The notification's title." : "The email's subject line."}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="w-preview">{push ? "Message on the phone" : "Inbox preview"}</Label>
          <Input ref={(el) => { fieldRefs.current.preview = el; }} {...props("preview")} className="h-11 text-base" />
          {shown.preview ? <FieldError id="w-preview-error">{shown.preview}</FieldError> : <p id="w-preview-hint" className="text-xs text-muted-foreground">{push ? "The line shown under the title on the lock screen." : "The line most inboxes show beside the subject."}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="w-body">{push ? "Full text" : "Message"}</Label>
          <Textarea ref={(el) => { fieldRefs.current.body = el; }} {...props("body")} rows={push ? 5 : 16} className="text-base leading-relaxed" />
          {shown.body ? (
            <FieldError id="w-body-error">{shown.body}</FieldError>
          ) : (
            <p id="w-body-hint" className="text-xs text-muted-foreground">
              {push ? "Kept in their message history, and sent as an email to anyone without the app. " : ""}Leave a blank line between paragraphs. A paragraph with an empty placeholder is left out, so an optional detail takes its sentence with it.
            </p>
          )}
        </div>
        {spec.ctaLabel !== undefined && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="w-ctaLabel">{push ? "Button in the message history" : "Button"}</Label>
            <Input ref={(el) => { fieldRefs.current.ctaLabel = el; }} {...props("ctaLabel")} className="h-11 text-base" />
            {shown.ctaLabel ? <FieldError id="w-ctaLabel-error">{shown.ctaLabel}</FieldError> : <p id="w-ctaLabel-hint" className="text-xs text-muted-foreground">Where it goes is set by the message, so links always work.</p>}
          </div>
        )}

        <fieldset className="flex flex-col gap-2 rounded-xl bg-muted/60 p-3">
          <legend className="sr-only">Placeholders</legend>
          <p className="text-sm font-semibold text-ink">Placeholders</p>
          <p className="-mt-1 text-xs text-muted-foreground">Filled in for each person when it is sent. Click one to add it where your cursor is.</p>
          <ul className="flex flex-col gap-1">
            {Object.entries(spec.placeholders).map(([name, description]) => (
              <li key={name} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(name)} className="rounded-md bg-card px-2 py-1 font-mono text-sm font-semibold text-teal-deep ring-1 ring-border transition-colors hover:bg-teal-tint-soft hover:ring-teal/50">
                  {`{${name}}`}
                </button>
                <span className="text-xs text-muted-foreground">{description}</span>
              </li>
            ))}
          </ul>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="h-11 px-5" disabled={pending || !changed || Object.keys(live).length > 0}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />} Save wording
          </Button>
          {changed && (
            <Button type="button" variant="ghost" className="h-11" disabled={pending} onClick={() => { setText(saved); setErrors({}); }}>
              <Undo2 className="size-4" aria-hidden /> Undo changes
            </Button>
          )}
          {custom && (
            <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={reset}>
              <RotateCcw className="size-4" aria-hidden /> Use the standard wording
            </Button>
          )}
        </div>
      </form>

      <section aria-labelledby="preview-h" className="flex flex-col gap-2 @4xl/admin:sticky @4xl/admin:top-6">
        <h2 id="preview-h" className="eyebrow">Preview, with example details</h2>
        {!push && (
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="break-words font-bold text-ink">{rendered.subject || <span className="font-normal text-muted-foreground">No subject</span>}</p>
            <p className="break-words text-sm text-muted-foreground">{rendered.preview}</p>
          </div>
        )}
        <MessagePreview m={{ push, subject: rendered.subject, preview: rendered.preview, body: rendered.body, ctaLabel: rendered.ctaLabel ?? null, ctaHref: null, signInLink, footerNote, time: "9:41" }} />
      </section>
    </div>
  );
}
