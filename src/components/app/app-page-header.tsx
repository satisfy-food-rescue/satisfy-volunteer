import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Back link for pages below a tab, such as a shift or the Me tab's pages. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-ink"
    >
      <ChevronLeft className="size-5" aria-hidden /> {label}
    </Link>
  );
}

/** The heading block every volunteer app page opens with, so the column reads
 *  the same from tab to tab: optional back link, eyebrow, title, intro. */
export function AppPageHeader({
  back,
  eyebrow,
  title,
  description,
  className,
}: {
  back?: { href: string; label: string };
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      {back && <BackLink {...back} />}
      <header className={cn(back && "mt-1")}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className={cn("break-words text-3xl leading-tight text-ink", eyebrow && "mt-1")}>{title}</h1>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      </header>
    </div>
  );
}
