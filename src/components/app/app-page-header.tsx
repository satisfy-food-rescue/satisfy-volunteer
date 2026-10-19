import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Back link for pages below a tab, such as a shift or the Me tab's pages. */
export function BackLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("-ml-2 inline-flex min-h-11 items-center gap-1 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-ink", className)}
    >
      <ChevronLeft className="size-5" aria-hidden /> {label}
    </Link>
  );
}

/**
 * The column every volunteer page sits in: phone gutters on a phone, wider
 * gutters and a capped measure once <main> has room. `reading` keeps forms
 * and long text to a comfortable line length.
 */
export function AppPage({
  width = "wide",
  className,
  children,
}: {
  width?: "wide" | "reading";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-6 px-5 pb-6 pt-5 @3xl/app:gap-8 @3xl/app:px-8 @3xl/app:pb-12 @3xl/app:pt-8 @6xl/app:px-12 @6xl/app:pt-10",
        width === "wide" ? "max-w-[88rem]" : "max-w-[52rem]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The heading block every volunteer app page opens with, so the column reads
 *  the same from tab to tab: optional back link, eyebrow, title, intro, and
 *  on wider screens any page-level controls to the right. */
export function AppPageHeader({
  back,
  eyebrow,
  title,
  description,
  aside,
  className,
}: {
  /** `tabBarOnly` for pages under the Me tab, which the sidebar lists
   *  alongside everything else, so there is nothing to go back to. */
  back?: { href: string; label: string; tabBarOnly?: boolean };
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Sits beside the title once there is room, below it on a phone. */
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      {back && <BackLink href={back.href} label={back.label} className={cn("@3xl/app:-mt-3", back.tabBarOnly && "lg:hidden")} />}
      <div className={cn("flex flex-col gap-4 @3xl/app:flex-row @3xl/app:items-end @3xl/app:justify-between @3xl/app:gap-8", back && "mt-1", back?.tabBarOnly && "lg:mt-0")}>
        <header className="min-w-0">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className={cn("break-words text-3xl leading-tight text-ink @3xl/app:text-4xl @6xl/app:text-[2.75rem]", eyebrow && "mt-1")}>{title}</h1>
          {description && <p className="mt-2 max-w-[38rem] text-muted-foreground @3xl/app:text-lg">{description}</p>}
        </header>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
    </div>
  );
}
