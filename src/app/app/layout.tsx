import { requireVolunteer } from "@/lib/session";
import { addDays, todayISO } from "@/lib/dates";
import { gapsBetween } from "@/lib/roster";
import { trainingContext } from "@/lib/volunteer-data";
import { BottomNav } from "@/components/app/bottom-nav";
import { AppHeader } from "@/components/app/app-header";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireVolunteer();
  const today = todayISO();
  const [gaps, training] = await Promise.all([
    gapsBetween(today, addDays(today, 28)),
    trainingContext(me, today),
  ]);
  const attention = training.summary.overdue + training.summary.notStarted;
  return (
    <div className="flex flex-1 justify-center bg-app-backdrop">
      <div className="relative flex min-h-dvh w-full max-w-[30rem] flex-col bg-background pb-24 md:border-x md:border-border">
        <AppHeader person={me} />
        <main className="flex flex-1 flex-col">{children}</main>
        <BottomNav badges={{ "/app/gaps": gaps.filter((g) => !g.released.some((r) => r.volunteerId === me.id)).length || undefined, "/app/training": attention || undefined }} />
      </div>
    </div>
  );
}
