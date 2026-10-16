import Link from "next/link";
import { BrandFooter, Logo } from "@/components/brand/logo";
import { ORG } from "@/lib/brand";

/** The frame every signed-out page shares: the blue/teal brand band with the
 *  white logo, a card that overlaps it, and the brand footer. */
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
    <main id="main" className="flex flex-1 flex-col">
      <div className="bg-teal px-4 pb-24 pt-10 sm:pb-28 sm:pt-12">
        <Link
          href="/sign-in"
          className="mx-auto flex w-fit rounded-xl focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-teal-on"
          aria-label={`${ORG.name} volunteers: sign in`}
        >
          <Logo tone="white" className="h-24 sm:h-28" />
        </Link>
      </div>
      <div className="-mt-16 flex flex-1 flex-col items-center px-4 pb-10 sm:-mt-20">
        <div className="w-full max-w-[26rem]">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h1 className="text-2xl text-ink sm:text-3xl">{title}</h1>
            {description && <div className="mt-2 text-ink-soft">{description}</div>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-6 text-center text-sm text-ink-soft">{footer}</div>}
        </div>
      </div>
      <BrandFooter className="mt-auto pb-6" />
    </main>
  );
}
