"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Check, FilePlus2, Loader2, Pencil, Send, X } from "lucide-react";
import { documentEmbedUrl } from "@satisfy/core/documents";
import { publishDocumentVersion, saveDocument, setDocumentArchived } from "@/app/admin/document-actions";
import type { DocumentInput } from "@/lib/document-admin";
import { useAction } from "@/components/admin/volunteer-admin-controls";
import { ActionButton } from "@/components/app/action-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ROLE_SHORT, VOLUNTEER_ROLES, type DocumentKind } from "@/lib/domain";
import { cn } from "@/lib/utils";

const Spinner = () => <Loader2 className="size-4 animate-spin" aria-hidden />;

export type DocumentForm = Omit<DocumentInput, "notify">;

const blank = (kind: DocumentKind): DocumentForm => ({ id: null, kind, title: "", summary: "", url: "", body: "", roles: kind === "AGREEMENT" ? [...VOLUNTEER_ROLES] : [] });

/** Adds a policy or agreement, or edits one. Editing changes nothing for
 *  volunteers until a new version is published. */
export function DocumentEditor({ document, kind }: { document?: DocumentForm; kind: DocumentKind }) {
  const initial = document ?? blank(kind);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const [notify, setNotify] = useState(false);
  const [pending, run] = useAction();
  const agreement = v.kind === "AGREEMENT";
  const key = v.id ?? `new-${kind}`;
  const embeddable = v.url ? documentEmbedUrl(v.url) !== null : false;

  if (!open) {
    return document ? (
      <Button variant="outline" size="sm" className="h-9" onClick={() => { setV(initial); setOpen(true); }}>
        <Pencil className="size-4" aria-hidden /> Edit
      </Button>
    ) : (
      <Button size="lg" variant={kind === "AGREEMENT" ? "default" : "outline"} onClick={() => { setV(initial); setNotify(false); setOpen(true); }}>
        <FilePlus2 className="size-4" aria-hidden /> {kind === "AGREEMENT" ? "Add an agreement" : "Add a policy"}
      </Button>
    );
  }

  return (
    <form
      className={cn("grid w-full basis-full gap-x-4 gap-y-5 rounded-xl border border-teal/25 bg-teal-tint-soft p-4 @xl/admin:grid-cols-2", document && "order-first mb-1")}
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveDocument({ ...v, notify: !document && notify }), () => setOpen(false));
      }}
    >
      {!document && <h3 className="text-xl text-ink @xl/admin:col-span-2">{agreement ? "New agreement" : "New policy"}</h3>}
      <div className="flex flex-col gap-1.5 @xl/admin:col-span-2">
        <Label htmlFor={`d-title-${key}`}>Title</Label>
        <Input id={`d-title-${key}`} required value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className="h-11 bg-card text-base" placeholder={agreement ? "For example, Volunteer Agreement" : "For example, Health and Safety Policy"} />
      </div>
      <div className="flex flex-col gap-1.5 @xl/admin:col-span-2">
        <Label htmlFor={`d-sum-${key}`}>Summary</Label>
        <Input id={`d-sum-${key}`} required value={v.summary} onChange={(e) => setV({ ...v, summary: e.target.value })} className="h-11 bg-card text-base" placeholder="One line shown in the list" />
      </div>
      <div className="flex flex-col gap-1.5 @xl/admin:col-span-2">
        <Label htmlFor={`d-url-${key}`}>Google Drive link</Label>
        <Input id={`d-url-${key}`} type="url" inputMode="url" value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} aria-describedby={`d-url-hint-${key}`} className="h-11 bg-card text-base" placeholder="https://drive.google.com/file/d/..." />
        <p id={`d-url-hint-${key}`} className={cn("text-xs", v.url && !embeddable ? "text-status-warn" : "text-muted-foreground")}>
          {v.url && !embeddable
            ? "This link opens in a new tab rather than inside the app. A Google Drive file or Google Doc can be shown inside the app."
            : "Volunteers see the document inside the app, always the latest from Drive. In Drive, share it as Anyone with the link: Viewer."}
        </p>
      </div>
      <div className="flex flex-col gap-1.5 @xl/admin:col-span-2">
        <Label htmlFor={`d-body-${key}`}>Words shown with it <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea id={`d-body-${key}`} rows={4} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} className="bg-card text-base leading-relaxed" placeholder={agreement ? "The key points, or the whole agreement if it is not in Drive." : "A short introduction, or the whole policy if it is not in Drive."} />
      </div>
      <fieldset className="flex flex-col gap-2 @xl/admin:col-span-2">
        <legend className="mb-2 text-sm font-medium">{agreement ? "Signed by" : "For"}</legend>
        <div className="flex flex-wrap gap-2">
          {VOLUNTEER_ROLES.map((r) => {
            const on = v.roles.includes(r);
            return (
              <label key={r} className={cn("flex h-10 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 font-display text-sm font-semibold transition-colors has-focus-visible:outline-3 has-focus-visible:outline-ring", on ? "border-teal bg-card text-teal-deep" : "border-border bg-card/60 text-muted-foreground hover:text-ink")}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => setV({ ...v, roles: on ? v.roles.filter((x) => x !== r) : VOLUNTEER_ROLES.filter((x) => x === r || v.roles.includes(x)) })} />
                {on && <Check className="size-4 text-teal" aria-hidden />}
                {ROLE_SHORT[r]}
              </label>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{agreement ? "Volunteers with any of these roles sign it before training or booking." : "Leave them all off for a policy everyone sees."}</p>
      </fieldset>
      {!document && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 @xl/admin:col-span-2">
          <Checkbox className="mt-0.5 size-5" checked={notify} onCheckedChange={setNotify} />
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-ink">Email and notify volunteers now</span>
            <span className="text-xs text-muted-foreground">{agreement ? "Everyone it is for is asked to sign it. Until they do, they cannot book new shifts." : "Everyone it is for is asked to read it and tick to confirm."}</span>
          </span>
        </label>
      )}
      {!document && agreement && !notify && <p className="text-sm text-status-warn @xl/admin:col-span-2">Volunteers with these roles will need to sign it before their next booking, even without an email.</p>}
      <div className="flex gap-2 @xl/admin:col-span-2">
        <Button type="submit" size="sm" className="h-10 px-4" disabled={pending}>{pending ? <Spinner /> : <Check className="size-4" aria-hidden />} {document ? "Save" : agreement ? "Add agreement" : "Add policy"}</Button>
        <Button type="button" variant="ghost" size="sm" className="h-10 px-4" onClick={() => { setV(initial); setOpen(false); }}><X className="size-4" aria-hidden /> Cancel</Button>
      </div>
    </form>
  );
}

/** A new version: volunteers read it again, or sign it again. */
export function PublishVersionButton({ id, title, agreement, nextVersion, audience }: { id: string; title: string; agreement: boolean; nextVersion: number; audience: number }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [pending, run] = useAction();
  return (
    <>
      <Button size="sm" className="h-9" onClick={() => { setNote(""); setNotify(true); setOpen(true); }}>
        <Send className="size-4" aria-hidden /> Publish a new version
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl text-ink">Publish version {nextVersion} of the {title}?</DialogTitle>
            <DialogDescription>
              {agreement
                ? `Do this once the new wording is final in Drive. All ${audience} volunteers it is for sign it again before their next booking.`
                : `Do this once the new wording is final in Drive. All ${audience} volunteers it is for are asked to read it and tick to confirm.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`pub-note-${id}`}>What changed <span className="font-normal text-muted-foreground">(shown to volunteers)</span></Label>
              <Textarea id={`pub-note-${id}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="text-base" placeholder="For example, The loading bay section now covers the new ramp." />
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
              <Checkbox className="mt-0.5 size-5" checked={notify} onCheckedChange={setNotify} />
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-ink">Email and notify volunteers</span>
                <span className="text-xs text-muted-foreground">An email, and a push to anyone with the app. Without it, they see it next time they open the app.</span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={pending} onClick={() => run(() => publishDocumentVersion({ id, note, notify }), () => setOpen(false))}>
              {pending ? <Spinner /> : <Send className="size-4" aria-hidden />} Publish version {nextVersion}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ArchiveDocumentButton({ id, title, archived, agreement }: { id: string; title: string; archived: boolean; agreement: boolean }) {
  return archived ? (
    <ActionButton variant="outline" size="sm" className="h-9" action={() => setDocumentArchived(id, false)}>
      <ArchiveRestore className="size-4" aria-hidden /> Restore
    </ActionButton>
  ) : (
    <ActionButton
      variant="ghost"
      size="sm"
      className="h-9 text-muted-foreground"
      action={() => setDocumentArchived(id, true)}
      confirm={{
        title: `Archive the ${title}?`,
        description: agreement ? "Volunteers stop seeing it and no longer need to sign it. The record of who signed it is kept." : "Volunteers stop seeing it. The record of who read it is kept.",
        confirmLabel: "Archive",
        cancelLabel: "Keep it",
      }}
    >
      <Archive className="size-4" aria-hidden /> Archive
    </ActionButton>
  );
}
