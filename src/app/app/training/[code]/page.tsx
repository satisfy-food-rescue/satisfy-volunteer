import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { db } from "@/lib/db";
import { todayISO, formatDate } from "@/lib/dates";
import { trainingContext } from "@/lib/volunteer-data";
import { TrainingChip } from "@/components/shared/status-chip";
import { ConfirmModuleForm } from "@/components/app/confirm-module-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Training module" };

export default async function ModulePage({ params }: { params: Promise<{ code: string }> }) {
  const me = await requireVolunteer();
  const { code } = await params;
  const mod = await db.trainingModule.findUnique({ where: { code } });
  if (!mod) notFound();
  const { statuses } = await trainingContext(me, todayISO());
  const st = statuses.find((s) => s.module.id === mod.id)!;
  const paragraphs = (mod.content ?? "").split("\n\n").filter(Boolean);

  return (
    <div className="flex flex-col gap-6 px-5 pb-6 pt-3">
      <Link href="/app/training" className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-ink">
        <ChevronLeft className="size-5" aria-hidden /> Training
      </Link>
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow">{mod.delivery === "ONLINE_CONFIRM" ? "Online: read and confirm" : "In-person session"}</p>
          <TrainingChip status={st.status} size="sm" />
        </div>
        <h1 className="mt-1 text-[1.9rem] leading-tight text-ink">{mod.name}</h1>
        <p className="mt-2 text-ink-soft">{mod.description}</p>
        {st.expiresISO && (
          <p className="mt-2 text-sm text-muted-foreground tabular">
            {st.status === "OVERDUE" ? "Expired" : "Expires"} {formatDate(st.expiresISO)}. Confirming today records a fresh {mod.validityMonths}-month completion.
          </p>
        )}
      </header>

      {mod.delivery === "ONLINE_CONFIRM" ? (
        <>
          <ol className="flex flex-col gap-3">
            {paragraphs.map((p, i) => (
              <li key={i} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-tint font-display font-bold text-teal-deep">{i + 1}</span>
                <p className="text-base leading-relaxed text-ink">{p}</p>
              </li>
            ))}
          </ol>
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>Confirming records the date against your name and lifts any booking block straight away. The coordinator can see who has completed what.</p>
          </div>
          <ConfirmModuleForm moduleId={mod.id} moduleName={mod.name} />
        </>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-ink">This module is completed in person. Book into a session from the Training page and the coordinator will mark your attendance on the day.</p>
          <Button className="mt-4 h-12 w-full text-base" render={<Link href="/app/training#sessions" />}>See sessions</Button>
        </div>
      )}
    </div>
  );
}
