import Link from "next/link";
import { SignedOutFrame } from "@/components/auth/auth-shell";
import { cn } from "@/lib/utils";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

/** The privacy policy and terms of use: a wide card in the signed-out frame
 *  with a contents list, so both read the same and are open to anyone,
 *  signed in or not (Google and the app stores link to them). */
export function LegalPage({
  eyebrow,
  title,
  intro,
  updated,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: React.ReactNode;
  /** When the substance last changed, e.g. "19 October 2026". */
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <SignedOutFrame width="wide">
      <article className="rounded-3xl border border-border bg-card px-5 py-8 shadow-sm sm:px-10 sm:py-10">
        <header>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 text-3xl text-ink sm:text-4xl">{title}</h1>
          <div className="mt-4 text-lg leading-relaxed text-ink-soft">{intro}</div>
          <p className="mt-3 text-sm text-muted-foreground">Last updated {updated}</p>
        </header>

        <nav aria-labelledby="contents-h" className="mt-8 rounded-2xl bg-teal-tint-soft px-5 py-4">
          <h2 id="contents-h" className="eyebrow">On this page</h2>
          <ol className="mt-3 gap-x-6 sm:columns-2">
            {sections.map((s) => (
              <li key={s.id} className="break-inside-avoid py-0.5">
                <a href={`#${s.id}`} className="font-semibold text-teal underline-offset-4 hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 flex flex-col gap-10">
          {sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-6">
              <h2 id={`${s.id}-h`} className="text-2xl text-ink">{s.title}</h2>
              <div className="mt-3 flex flex-col gap-3 leading-relaxed text-ink-soft">{s.body}</div>
            </section>
          ))}
        </div>
      </article>
    </SignedOutFrame>
  );
}

/** A bulleted list inside a section. */
export function LegalList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <ul className={cn("ml-5 flex list-disc flex-col gap-2 marker:text-teal", className)}>{children}</ul>;
}

const LINK = "break-words font-semibold text-teal underline underline-offset-4";

/** A link inside a section; other websites open in a new tab. */
export function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (href.startsWith("/")) return <Link href={href} className={LINK}>{children}</Link>;
  const external = /^https?:/.test(href);
  return (
    <a href={href} className={LINK} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}

/** A term in bold at the start of a list item. */
export function Term({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}
