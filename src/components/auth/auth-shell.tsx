import Link from "next/link";
import { BrandFooter, Logo } from "@/components/brand/logo";
import { ORG } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** The frame every signed-out page shares: the blue/teal brand band with the
 *  white logo, content that overlaps it, the privacy and terms links, and the
 *  brand footer. */
export function SignedOutFrame({ children, width = "narrow" }: { children: React.ReactNode; width?: "narrow" | "wide" }) {
  return (
    <main id="main" className="flex flex-1 flex-col">
      <div className="bg-teal px-4 pb-24 pt-10 sm:pb-28 sm:pt-12">
        <Link
          href="/"
          className="mx-auto flex w-fit rounded-xl focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-teal-on"
          aria-label={`${ORG.name} volunteers: home`}
        >
          <Logo tone="white" className="h-24 sm:h-28" />
        </Link>
      </div>
      <div className="-mt-16 flex flex-1 flex-col items-center px-4 pb-10 sm:-mt-20">
        <div className={cn("w-full", width === "narrow" ? "max-w-[26rem]" : "max-w-3xl")}>
          {children}
          <LegalLinks className="mt-8" />
        </div>
      </div>
      <BrandFooter className="mt-auto pb-6" />
    </main>
  );
}

/** Links to the privacy policy and terms of use. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={cn("flex justify-center gap-6 text-sm", className)}>
      <Link href="/privacy" className="font-semibold text-ink-soft underline-offset-4 hover:text-teal hover:underline">
        Privacy policy
      </Link>
      <Link href="/terms" className="font-semibold text-ink-soft underline-offset-4 hover:text-teal hover:underline">
        Terms of use
      </Link>
    </nav>
  );
}

/** A signed-out form page: a single card in the signed-out frame. */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <SignedOutFrame>
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl text-ink sm:text-3xl">{title}</h1>
        {description && <div className="mt-2 text-ink-soft">{description}</div>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-6 text-center text-sm text-ink-soft">{footer}</div>}
    </SignedOutFrame>
  );
}
