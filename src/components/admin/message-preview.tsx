import Link from "next/link";
import { ORG } from "@/lib/brand";
import { Logo, LogoIcon } from "@/components/brand/logo";

export type PreviewMessage = {
  push: boolean;
  subject: string;
  preview: string;
  body: string;
  ctaLabel: string | null;
  /** Where the button goes; null when it carries a sign-in link, which is
   *  never stored, or in a template preview. */
  ctaHref: string | null;
  /** The button is a single-use sign-in link. */
  signInLink?: boolean;
  /** The email footer line for who it is to. */
  footerNote: string;
  /** The lock-screen clock for a push. */
  time: string;
};

/** A message drawn the way it arrives: an email with the brand header, one
 *  button and a quiet footer, or a push on a lock screen. Shared by the
 *  Outbox and the email wording editor. */
export function MessagePreview({ m }: { m: PreviewMessage }) {
  if (m.push) {
    return (
      <div className="rounded-2xl bg-teal-deep p-6 @xl/admin:p-10">
        <div className="mx-auto max-w-[24rem]">
          <p className="text-center font-display text-5xl font-bold text-white tabular">{m.time}</p>
          <div className="mt-6 rounded-2xl bg-white/90 p-3.5 shadow-lg backdrop-blur">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex size-5 items-center justify-center rounded-md bg-teal"><LogoIcon tone="white" className="size-3.5" /></span>
              <span className="font-semibold uppercase tracking-wide">Satisfy</span>
              <span className="ml-auto">now</span>
            </div>
            <p className="mt-1.5 font-bold text-ink">{m.subject}</p>
            <p className="text-sm leading-snug text-ink-soft">{m.preview}</p>
          </div>
          {m.ctaHref && (
            <p className="mt-4 text-center text-sm text-white/80">
              Tapping it opens <Link href={m.ctaHref} className="font-semibold text-white underline underline-offset-2">the page in the volunteer app</Link>.
            </p>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-app-backdrop p-4 @xl/admin:p-8">
      <div className="mx-auto max-w-[36rem] overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="flex justify-center bg-teal px-6 py-6">
          <Logo tone="white" className="h-16" />
        </div>
        <div className="px-6 py-6 text-[1.05rem] leading-relaxed text-ink">
          {m.body.split("\n\n").map((p, i) => (
            <p key={i} className="mb-4 whitespace-pre-line break-words last:mb-0">{p}</p>
          ))}
          {m.ctaLabel && m.ctaHref && (
            <p className="my-6">
              <Link href={m.ctaHref} className="inline-block rounded-full bg-teal px-6 py-3 font-display font-bold text-white no-underline hover:bg-teal-deep">{m.ctaLabel}</Link>
            </p>
          )}
          {m.ctaLabel && !m.ctaHref && (
            <p className="my-6">
              <span className="inline-block rounded-full bg-teal px-6 py-3 font-display font-bold text-white">{m.ctaLabel}</span>
              {m.signInLink && <span className="mt-2 block text-sm text-muted-foreground">The sign-in link is single-use and never stored, so it is not shown here.</span>}
            </p>
          )}
        </div>
        {/* The brand ribbons as the email draws them: a simple three-colour
            rule. The page's own footer already shows the full ribbons. */}
        <div className="grid h-1 grid-cols-3" aria-hidden>
          <span className="bg-teal" />
          <span className="bg-(--brand-orange-50)" />
          <span className="bg-green" />
        </div>
        <div className="bg-background px-6 py-4 text-xs leading-relaxed text-muted-foreground">
          <p>{ORG.name} · {ORG.base}</p>
          <p>{m.footerNote}</p>
        </div>
      </div>
    </div>
  );
}
