import { ExternalLink } from "lucide-react";
import { documentEmbedUrl, documentSiteLabel } from "@satisfy/core/documents";
import { moduleParagraphs } from "@satisfy/core/training";
import { cn } from "@/lib/utils";

/** A policy or agreement: the Google Drive document itself, embedded so it
 *  is always the board's latest, and any words written here. Anything that
 *  cannot be embedded opens as a link. */
export function DocumentFrame({ title, url, body, className, frameClassName }: { title: string; url: string | null; body: string | null; className?: string; frameClassName?: string }) {
  const embed = url ? documentEmbedUrl(url) : null;
  const paragraphs = moduleParagraphs(body);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {paragraphs.length > 0 && (
        <div className="flex flex-col gap-3 text-ink">
          {paragraphs.map((p, i) => (
            <p key={i} className="whitespace-pre-line leading-relaxed">{p}</p>
          ))}
        </div>
      )}
      {embed && (
        <div className="overflow-hidden rounded-xl border border-border bg-muted">
          <iframe src={embed} title={title} loading="lazy" allow="fullscreen" referrerPolicy="strict-origin-when-cross-origin" className={cn("block h-[70dvh] max-h-[52rem] min-h-[26rem] w-full bg-card", frameClassName)} />
        </div>
      )}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-teal hover:underline">
          <ExternalLink className="size-4" aria-hidden />
          {embed ? `Open in ${documentSiteLabel(url)}` : `Read it on ${documentSiteLabel(url)}`}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
    </div>
  );
}
