import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { cn } from "@/lib/utils";

// Blue/teal brand bar with the white logo, the treatment from the brand sheet.
// The home page continues the band below it to hold the greeting.
export function AppHeader({ person, className }: { person: { firstName: string; lastName?: string | null }; className?: string }) {
  return (
    <header className={cn("flex items-center justify-between bg-teal px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))] text-white md:px-8", className)}>
      <Link href="/app" className="-m-1 rounded-lg p-1" aria-label="Home">
        <Logo tone="white" className="h-12" />
      </Link>
      <Link href="/app/profile" className="tap flex items-center justify-center rounded-full" aria-label="My profile">
        <AvatarBadge person={person} size="md" className="ring-2 ring-white/70" />
      </Link>
    </header>
  );
}
