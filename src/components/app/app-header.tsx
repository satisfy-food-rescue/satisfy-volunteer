import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { AvatarBadge } from "@/components/shared/avatar-badge";

export function AppHeader({ person }: { person: { firstName: string; lastName?: string | null } }) {
  return (
    <header className="flex items-center justify-between px-5 pt-4">
      <Link href="/app" className="flex items-center gap-2" aria-label="Home">
        <LogoMark size={40} />
        <span className="font-display text-[0.95rem] tracking-[0.08em] text-ink">SATISFY</span>
      </Link>
      <Link href="/app/profile" className="tap flex items-center justify-center" aria-label="My profile">
        <AvatarBadge person={person} size="sm" />
      </Link>
    </header>
  );
}
