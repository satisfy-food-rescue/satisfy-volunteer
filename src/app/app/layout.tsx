import { requireVolunteer } from "@/lib/session";
import { dateToISO, formatMonth, todayISO } from "@/lib/dates";
import { ORG } from "@/lib/brand";
import { coverGaps, coverableGaps, trainingContext } from "@/lib/volunteer-data";
import { BottomNav } from "@/components/app/bottom-nav";
import { AppHeader } from "@/components/app/app-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { BrandFooter } from "@/components/brand/logo";

export const dynamic = "force-dynamic";

// Phones get the teal header and the tab bar. From 1024px the sidebar takes
// over. Pages lay themselves out against the width of <main> (@container/app),
// not the window, so they read the same beside the sidebar or without it.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireVolunteer();
  const today = todayISO();
  const [gaps, training] = await Promise.all([coverGaps(me.id, today), trainingContext(me, today)]);
  const coverable = coverableGaps(gaps, { me, statuses: training.statuses, today });
  const attention = training.summary.overdue + training.summary.notStarted;
  const badges = { "/app/gaps": coverable.length || undefined, "/app/training": attention || undefined };
  // Only what the chrome shows: a client component's props are sent to the
  // browser whole, and the full record holds the coordinator's notes.
  const person = { firstName: me.firstName, lastName: me.lastName };
  return (
    <div className="flex min-h-dvh flex-1">
      <AppSidebar
        person={person}
        since={`Volunteer since ${formatMonth(dateToISO(me.joinedAt))}`}
        badges={badges}
        coordinatorEmail={ORG.coordinatorEmail}
        className="hidden lg:flex"
      />
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0">
        <AppHeader person={person} className="lg:hidden" />
        <main id="main" className="@container/app flex flex-1 flex-col">{children}</main>
        <BrandFooter className="mt-4 pb-4" />
        <BottomNav badges={badges} className="lg:hidden" />
      </div>
    </div>
  );
}
