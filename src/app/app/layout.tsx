import { requireVolunteer } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { coverableGaps, trainingContext } from "@/lib/volunteer-data";
import { BottomNav } from "@/components/app/bottom-nav";
import { AppHeader } from "@/components/app/app-header";
import { BrandFooter } from "@/components/brand/logo";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireVolunteer();
  const today = todayISO();
  const [coverable, training] = await Promise.all([coverableGaps(me.id, today), trainingContext(me, today)]);
  const attention = training.summary.overdue + training.summary.notStarted;
  return (
    <div className="flex flex-1 justify-center bg-app-backdrop">
      <div className="relative flex min-h-dvh w-full max-w-[30rem] flex-col bg-background pb-24 md:border-x md:border-border">
        <AppHeader person={me} />
        <main className="flex flex-1 flex-col">{children}</main>
        <BrandFooter className="mt-4 pb-4" />
        <BottomNav badges={{ "/app/gaps": coverable.length || undefined, "/app/training": attention || undefined }} />
      </div>
    </div>
  );
}
