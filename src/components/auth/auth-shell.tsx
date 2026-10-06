import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { ORG } from "@/lib/brand";

/** Centered card used by every signed-out page. */
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
    <main className="flex flex-1 flex-col items-center bg-green-tint-soft px-4 py-10 sm:py-16">
      <div className="w-full max-w-[26rem]">
        <Link href="/sign-in" className="mx-auto mb-6 flex w-fit rounded-full focus-visible:outline-3 focus-visible:outline-green" aria-label={`${ORG.name} volunteers: sign in`}>
          <LogoMark size={88} />
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl text-ink sm:text-3xl">{title}</h1>
          {description && <div className="mt-2 text-ink-soft">{description}</div>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-ink-soft">{footer}</div>}
      </div>
    </main>
  );
}
