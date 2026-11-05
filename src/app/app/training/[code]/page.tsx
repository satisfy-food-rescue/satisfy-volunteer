import Link from "next/link";
import { notFound } from "next/navigation";
import { Hammer, Lock, ShieldCheck } from "lucide-react";
import { moduleParagraphs } from "@satisfy/core/training";
import { requireVolunteer } from "@/lib/session";
import { db } from "@/lib/db";
import { todayISO, formatDate } from "@/lib/dates";
import { trainingContext } from "@/lib/volunteer-data";
import { Chip, TrainingChip } from "@/components/shared/status-chip";
import { trainingLockOf } from "@/lib/induction";
import { OnlineModule } from "@/components/app/online-module";
import { AppPage, AppPageHeader } from "@/components/app/app-page-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Training module" };

export default async function ModulePage({ params }: { params: Promise<{ code: string }> }) {
  const me = await requireVolunteer();
  const { code } = await params;
  const mod = await db.trainingModule.findUnique({ where: { code }, include: { links: { orderBy: { order: "asc" } } } });
  if (!mod) notFound();
  const { statuses, induction } = await trainingContext(me, todayISO());
  const st = statuses.find((s) => s.module.id === mod.id)!;
  const paragraphs = moduleParagraphs(mod.content);
  const locked = trainingLockOf(me, st, induction);
  const lock = locked?.text ?? null;
  const unlock =
    locked?.kind === "development"
      ? { href: "/app/training", label: "Back to my training" }
      : locked?.kind === "induction"
        ? { href: "/app/induction", label: "Finish my induction" }
        : locked?.kind === "after" && st.lockedBy
          ? { href: st.lockedBy.delivery === "ONLINE_CONFIRM" ? `/app/training/${st.lockedBy.code}` : "/app/training#sessions", label: `Go to ${st.lockedBy.name}` }
          : null;

  return (
    <AppPage width="reading" className="pt-3">
      <div className="flex flex-col gap-3">
        <AppPageHeader
          back={{ href: "/app/training", label: "Training" }}
          eyebrow={mod.delivery === "ONLINE_CONFIRM" ? (mod.links.length ? "Online: read, watch and confirm" : "Online: read and confirm") : "In-person session"}
          title={mod.name}
          description={mod.description}
        />
        {mod.inDevelopment ? <Chip tone="neutral" size="sm" icon={Hammer} className="self-start">Coming soon</Chip> : <TrainingChip status={st.status} size="sm" className="self-start" />}
        {st.expiresISO && (
          <p className="text-sm text-muted-foreground tabular">
            {st.status === "OVERDUE" ? "Expired" : "Expires"} {formatDate(st.expiresISO)}. Confirming today records a fresh {mod.validityMonths}-month completion.
          </p>
        )}
      </div>

      {lock ? (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
          <Lock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-ink">{lock}</p>
            {unlock && <Button variant="outline" className="mt-4 h-12 w-full text-base @3xl/app:w-auto @3xl/app:px-8" render={<Link href={unlock.href} />}>{unlock.label}</Button>}
          </div>
        </div>
      ) : mod.delivery === "ONLINE_CONFIRM" ? (
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
