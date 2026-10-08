import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { AvatarBadge } from "@/components/shared/avatar-badge";

// Blue/teal brand bar with the white logo, the treatment from the brand sheet.
// The home page continues the band below it to hold the greeting.
export function AppHeader({ person }: { person: { firstName: string; lastName?: string | null } }) {
  return (
    <header className="flex items-center justify-between bg-teal px-5 pb-3 pt-4 text-white">
      <Link href="/app" className="-m-1 rounded-lg p-1" aria-label="Home">
        <Logo tone="white" className="h-12" />
      </Link>
      <Link href="/app/profile" className="tap flex items-center justify-center rounded-full" aria-label="My profile">
        <AvatarBadge person={person} size="md" className="ring-2 ring-white/70" />
      </Link>
    </header>
  );
}
