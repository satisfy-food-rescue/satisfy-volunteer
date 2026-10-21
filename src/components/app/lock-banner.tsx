import Link from "next/link";
import { Lock } from "lucide-react";
import type { Eligibility } from "@/lib/training";

/** Why some shifts are locked, said once above a list rather than on every
 *  card. Grey, not orange: orange is for shifts that need cover. One action:
 *  training when any lock is training, since the volunteer can fix that
 *  themselves, else asking for a role. */
export function LockBanner({ title, locks }: { title: string; locks: Eligibility[] }) {
  // Training first: it is what the action button leads to.
  const ordered = [...locks].sort((a, b) => Number(b.hasRole) - Number(a.hasRole));
  const reasons = [...new Set(ordered.map((e) => e.reason).filter((r): r is string => !!r))];
  if (reasons.length === 0) return null;
  const training = locks.filter((e) => e.hasRole && e.blockers.length > 0);
  const modules = [...new Set(training.map((e) => e.blockers[0].module.code))];
  const action =
    training.length > 0
      ? { href: modules.length === 1 ? `/app/training/${modules[0]}` : "/app/training", label: "Go to my training" }
      : { href: "/app/profile", label: "Ask to change my roles" };
  return (
    <div className="flex gap-3 rounded-2xl bg-status-neutral-bg p-4 text-status-neutral">
      <Lock className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-sm leading-snug @3xl/app:flex @3xl/app:items-center @3xl/app:justify-between @3xl/app:gap-6">
        <div>
          <p className="font-bold text-ink">{title}</p>
          <ul className="mt-1 flex flex-col gap-1">
            {reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
        <Link href={action.href} className="mt-2 inline-flex min-h-11 shrink-0 items-center font-semibold text-teal hover:underline @3xl/app:mt-0">
          {action.label}
        </Link>
      </div>
    </div>
  );
}
