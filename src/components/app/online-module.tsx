"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Circle, ExternalLink, Loader2, Lock, PlayCircle } from "lucide-react";
import { completionGate, isVideo, linkKindLabel, type ModuleLink } from "@satisfy/core/training";
import { completeOnlineModule } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Remembers opened links for this tab, so a reload does not undo them. */
function useOpenedLinks(moduleId: string) {
  const storageKey = `module-links:${moduleId}`;
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      // Restoring browser-held state after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setOpened(new Set(JSON.parse(saved) as string[]));
    } catch {
      // Storage unavailable: opening the links again is all it costs.
    }
  }, [storageKey]);
  const markOpened = (id: string) =>
    setOpened((prev) => {
      const next = new Set(prev).add(id);
      try {
        sessionStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // See above.
      }
      return next;
    });
  return [opened, markOpened] as const;
}

/** An online module: numbered points to read, videos or links to open, then
 *  the confirmation, which stays locked until both are done. */
export function OnlineModule({ moduleId, moduleName, paragraphs, links }: { moduleId: string; moduleName: string; paragraphs: string[]; links: ModuleLink[] }) {
  const [readToEnd, setReadToEnd] = useState(paragraphs.length === 0);
  const [opened, markOpened] = useOpenedLinks(moduleId);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = endRef.current;
    if (!el || readToEnd) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setReadToEnd(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [readToEnd]);

  const gate = completionGate({ hasContent: paragraphs.length > 0, readToEnd, links, opened });

  return (
    <>
      {paragraphs.length > 0 && (
        <section aria-label="Read">
          <ol className="flex flex-col gap-3">
            {paragraphs.map((p, i) => (
              <li key={i} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-tint font-display font-bold text-teal-deep">{i + 1}</span>
                <p className="text-base leading-relaxed text-ink">{p}</p>
              </li>
            ))}
          </ol>
          <div ref={endRef} aria-hidden className="h-px" />
        </section>
      )}

      {links.length > 0 && (
        <section aria-labelledby="watch-h" className="flex flex-col gap-2.5">
          <h2 id="watch-h" className="text-xl text-ink">{links.every((l) => isVideo(l.url)) ? (links.length === 1 ? "Watch the video" : "Watch the videos") : "Open each link"}</h2>
          <ul className="flex flex-col gap-2.5">
            {links.map((l) => {
              const done = opened.has(l.id);
              const video = isVideo(l.url);
              const Icon = video ? PlayCircle : ExternalLink;
              return (
                <li key={l.id}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => markOpened(l.id)}
                    onAuxClick={() => markOpened(l.id)}
                    className={cn("group flex min-h-16 items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-sm transition-colors hover:border-teal/60", done ? "border-green/60" : "border-border")}
                  >
                    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", video ? "bg-sky-tint text-sky-text" : "bg-teal-tint text-teal-deep")}>
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-ink">{l.label}</span>
                      <span className={cn("block text-sm", done ? "font-semibold text-green-text" : "text-muted-foreground")}>
                        {linkKindLabel(l.url)} · {done ? "opened" : "opens in a new tab"}
                      </span>
                    </span>
                    {done ? <CheckCircle2 className="size-6 shrink-0 text-green-text" aria-hidden /> : <ExternalLink className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ConfirmModuleForm moduleId={moduleId} moduleName={moduleName} gate={gate} />
    </>
  );
}

function ConfirmModuleForm({ moduleId, moduleName, gate }: { moduleId: string; moduleName: string; gate: ReturnType<typeof completionGate> }) {
  const [checked, setChecked] = useState(false);
  const [pending, run] = useTransition();
  const router = useRouter();
  const locked = !gate.ready;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-teal/25 bg-teal-tint-soft p-5">
      {gate.steps.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Before you confirm">
          {gate.steps.map((s) => (
            <li key={s.key} className={cn("flex items-center gap-2 text-sm font-semibold", s.done ? "text-green-text" : "text-ink-soft")}>
              {s.done ? <CheckCircle2 className="size-5 shrink-0" aria-hidden /> : <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
              <span>{s.label}</span>
              <span className="sr-only">{s.done ? "done" : "not done yet"}</span>
            </li>
          ))}
        </ul>
      )}
      <label className={cn("flex items-start gap-3 rounded-xl border bg-white p-4 transition-colors has-focus-visible:outline-3 has-focus-visible:outline-ring", locked ? "cursor-not-allowed opacity-60" : "cursor-pointer", checked ? "border-teal" : "border-border")}>
        <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--brand-teal)]" disabled={locked} checked={checked && !locked} onChange={(e) => setChecked(e.target.checked)} aria-describedby={locked ? `gate-hint-${moduleId}` : undefined} />
        <span className="text-base leading-snug text-ink">I have read and understood {moduleName} and will follow it on every shift.</span>
      </label>
      {locked && (
        <p id={`gate-hint-${moduleId}`} className="-mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" aria-hidden /> Unlocks once the steps above are done.
        </p>
      )}
      <Button
        size="lg"
        className="h-12 text-base"
        disabled={locked || !checked || pending}
        onClick={() =>
          run(async () => {
            const r = await completeOnlineModule(moduleId);
            if (r.ok) {
              toast.success(r.message);
              router.push("/app/training");
              router.refresh();
            } else toast.error(r.error);
          })
        }
      >
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <CheckCircle2 className="size-5" aria-hidden />}
        Record completion
      </Button>
    </div>
  );
}
