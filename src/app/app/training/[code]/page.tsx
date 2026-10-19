import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { moduleParagraphs } from "@satisfy/core/training";
import { requireVolunteer } from "@/lib/session";
import { db } from "@/lib/db";
import { todayISO, formatDate } from "@/lib/dates";
import { trainingContext } from "@/lib/volunteer-data";
import { TrainingChip } from "@/components/shared/status-chip";
import { OnlineModule } from "@/components/app/online-module";
import { AppPage, AppPageHeader } from "@/components/app/app-page-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Training module" };

export default async function ModulePage({ params }: { params: Promise<{ code: string }> }) {
  const me = await requireVolunteer();
  const { code } = await params;
  const mod = await db.trainingModule.findUnique({ where: { code }, include: { links: { orderBy: { order: "asc" } } } });
  if (!mod) notFound();
  const { statuses } = await trainingContext(me, todayISO());
  const st = statuses.find((s) => s.module.id === mod.id)!;
  const paragraphs = moduleParagraphs(mod.content);

  return (
    <AppPage width="reading" className="pt-3">
      <div className="flex flex-col gap-3">
        <AppPageHeader
          back={{ href: "/app/training", label: "Training" }}
          eyebrow={mod.delivery === "ONLINE_CONFIRM" ? (mod.links.length ? "Online: read, watch and confirm" : "Online: read and confirm") : "In-person session"}
          title={mod.name}
          description={mod.description}
        />
        <TrainingChip status={st.status} size="sm" className="self-start" />
        {st.expiresISO && (
          <p className="text-sm text-muted-foreground tabular">
            {st.status === "OVERDUE" ? "Expired" : "Expires"} {formatDate(st.expiresISO)}. Confirming today records a fresh {mod.validityMonths}-month completion.
          </p>
        )}
      </div>

      {mod.delivery === "ONLINE_CONFIRM" ? (
        <>
          <OnlineModule moduleId={mod.id} moduleName={mod.name} paragraphs={paragraphs} links={mod.links.map((l) => ({ id: l.id, label: l.label, url: l.url }))} />
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>Confirming records the date against your name and lifts any booking block straight away. The coordinator can see who has completed what.</p>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-ink">This module is completed in person. Book into a session from the Training page and the coordinator will mark your attendance on the day.</p>
          <Button className="mt-4 h-12 w-full text-base @3xl/app:w-auto @3xl/app:px-8" render={<Link href="/app/training#sessions" />}>See sessions</Button>
        </div>
      )}
    </AppPage>
  );
}
