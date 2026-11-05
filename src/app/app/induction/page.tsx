import Link from "next/link";
import { CheckCircle2, ChevronRight, ExternalLink, FileSignature, GraduationCap, HeartHandshake, Mail, UserCheck } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { MOJ_CHECK_URL, MOJ_RENEWAL_DAYS } from "@/lib/domain";
import { ORG } from "@/lib/brand";
import { inductionFor } from "@/lib/induction-data";
import { inductionToDo, type AgreementState, type Moj } from "@/lib/induction";
import { AppPage, AppPageHeader } from "@/components/app/app-page-header";
import { Chip } from "@/components/shared/status-chip";
import { DocumentFrame } from "@/components/shared/document-frame";
import { AgreementSigning } from "@/components/app/agreement-signing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Your induction" };

// The steps before training or shifts, in the order they are best done: the
// Ministry of Justice check first (a failed check would waste training time),
// then the agreements, then training.
export default async function InductionPage() {
  const me = await requireVolunteer();
  const today = todayISO();
  const induction = await inductionFor(me, today);
  const { moj } = induction;
  const agreements = induction.agreements.filter((a) => a.required);
  const toSign = agreements.filter((a) => a.status === "UNSIGNED" || a.status === "UPDATED");
  const showMoj = moj.required || moj.checkedISO !== null;
  let step = 0;

  return (
    <AppPage className="pt-3">
      <AppPageHeader
        back={{ href: "/app/profile", label: "Me", tabBarOnly: true }}
        eyebrow="Getting started"
        title="Your induction"
        description={
          induction.complete
            ? "All done. Thank you: your training and shifts are open to you."
            : `Before your first training session or shift, we need ${inductionToDo(induction)}. It keeps everyone safe, including you.`
        }
      />

      <ol className="flex max-w-[52rem] flex-col gap-4">
        {showMoj && (
          <Step n={++step} done={moj.status === "CURRENT" || moj.status === "NOT_REQUIRED"} icon={UserCheck} title="Ministry of Justice check" chip={<MojChip moj={moj} />}>
            <MojStep moj={moj} />
          </Step>
        )}

        {agreements.length > 0 && (
          <Step n={++step} done={toSign.length === 0} icon={FileSignature} title={agreements.length === 1 ? agreements[0]!.document.title : "Volunteer agreements"} chip={toSign.length === 0 ? <Chip tone="good" size="sm" icon={CheckCircle2}>Signed</Chip> : <Chip tone="info" size="sm">To sign</Chip>}>
            <p className="text-ink-soft">
              {toSign.length === 0
                ? "Thanks for signing. You can read them again at any time under Policies."
                : agreements.length === 1
                  ? "Please read it before you come onto the premises, even for training."
                  : "You will see confidential information while volunteering, and these cover how we look after it and each other. Please read them before you come onto the premises, even for training."}
            </p>
            {agreements.map((a) => (
              <AgreementCard key={a.document.id} a={a} />
            ))}
            {toSign.length > 0 && (
              <AgreementSigning firstName={me.firstName} agreements={toSign.map((a) => ({ id: a.document.id, version: a.document.version, title: a.document.title, updated: a.status === "UPDATED" }))} />
            )}
          </Step>
        )}

        <Step n={++step} done={false} icon={GraduationCap} title="Training" last>
          <p className="text-ink-soft">
            {induction.complete
              ? "Your training is open. Start with your initial visit to the warehouse, then the online modules."
              : "Your training opens as soon as the steps above are done. You can look at what is involved now."}
          </p>
          <Button variant={induction.complete ? "default" : "outline"} className="h-12 text-base @3xl/app:self-start @3xl/app:px-8" render={<Link href="/app/training" />}>
            Go to my training <ChevronRight className="size-5" aria-hidden />
          </Button>
        </Step>
      </ol>
    </AppPage>
  );
}

/** A numbered step. With room, the numbers run down a rail beside the
 *  cards; on a phone each card carries its own, so the text keeps the width. */
function Step({ n, done, icon: Icon, title, chip, last, children }: { n: number; done: boolean; icon: React.ComponentType<{ className?: string }>; title: string; chip?: React.ReactNode; last?: boolean; children: React.ReactNode }) {
  const marker = (className: string) => (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full font-display font-bold tabular", done ? "bg-green-tint text-green-deep" : "bg-teal-tint text-teal-deep", className)}>
      {done ? <CheckCircle2 className="size-5" aria-label={`Step ${n}, done`} /> : <><span className="sr-only">Step </span>{n}</>}
    </span>
  );
  return (
    <li className={cn("relative flex gap-4", !last && "@3xl/app:pb-2")}>
      <div className="hidden flex-col items-center @3xl/app:flex" aria-hidden>
        {marker("size-10")}
        {!last && <span className="mt-2 w-0.5 flex-1 rounded-full bg-border" />}
      </div>
      <section className="flex min-w-0 flex-1 flex-col gap-3 rounded-2xl border border-border bg-card p-4 @3xl/app:p-5" aria-labelledby={`step-${n}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="@3xl/app:hidden">{marker("size-8 text-sm")}</span>
          <Icon className="hidden size-5 text-teal @3xl/app:block" aria-hidden />
          <h2 id={`step-${n}`} className="min-w-0 flex-1 text-xl text-ink">{title}</h2>
          {chip}
        </div>
        {children}
      </section>
    </li>
  );
}

function MojChip({ moj }: { moj: Moj }) {
  if (moj.status === "CURRENT" || moj.status === "NOT_REQUIRED") return <Chip tone="good" size="sm" icon={CheckCircle2}>Recorded</Chip>;
  if (moj.status === "RENEWAL_DUE") return <Chip tone="warn" size="sm">Renewal due</Chip>;
  if (moj.status === "EXPIRED") return <Chip tone="bad" size="sm">Needs renewing</Chip>;
  return <Chip tone="info" size="sm">To do</Chip>;
}

/** How to get the check, said supportively: it is free, done online, and
 *  anyone without a computer or scanner gets a hand from the coordinator. */
function MojStep({ moj }: { moj: Moj }) {
  if (moj.status === "CURRENT" || (moj.status === "NOT_REQUIRED" && moj.checkedISO)) {
    return (
      <p className="text-ink-soft">
        Recorded by the coordinator, dated {formatDate(moj.checkedISO!)}. It is renewed every three years: we will remind you before {formatDate(moj.renewsISO!)}.
      </p>
    );
  }
  const renewing = moj.status === "RENEWAL_DUE" || moj.status === "EXPIRED";
  return (
    <>
      <p className="text-ink-soft">
        {moj.status === "EXPIRED"
          ? `Your check ran out on ${formatDate(moj.renewsISO!)}, so new bookings are paused until we have a new one. Your regular slot is not affected.`
          : moj.status === "RENEWAL_DUE"
            ? `Your check is three years old on ${formatDate(moj.renewsISO!)}. The Ministry can take up to 20 working days, so we ask for a new one ${MOJ_RENEWAL_DAYS} days ahead.`
            : "We ask every volunteer for a Ministry of Justice criminal record check before training, as we work alongside people from all walks of life. It is free, and you request it yourself online."}
      </p>
      <ol className="flex flex-col gap-2.5 text-ink">
        <li className="flex gap-3">
          <Num>1</Num>
          <span>
            {renewing ? "Request a new check" : "Request your own criminal record check"} on the Ministry of Justice website. You will need a photo ID, such as a driver licence or passport.
            <a href={MOJ_CHECK_URL} target="_blank" rel="noopener noreferrer" className="mt-1 flex min-h-11 items-center gap-1.5 font-semibold text-teal hover:underline">
              <ExternalLink className="size-4" aria-hidden /> Request it at justice.govt.nz<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </span>
        </li>
        <li className="flex gap-3">
          <Num>2</Num>
          <span>When it arrives by email, usually within 20 working days, forward it to <a href={`mailto:${ORG.coordinatorEmail}`} className="font-semibold text-teal [overflow-wrap:anywhere] hover:underline">{ORG.coordinatorEmail}</a>, or bring it in.</span>
        </li>
        <li className="flex gap-3">
          <Num>3</Num>
          <span>The volunteer coordinator records the date here, and this step ticks itself off.</span>
        </li>
      </ol>
      <div className="flex items-start gap-3 rounded-xl bg-green-tint-soft p-3 ring-1 ring-green/30">
        <HeartHandshake className="mt-0.5 size-5 shrink-0 text-green-deep" aria-hidden />
        <p className="text-sm text-ink">
          <span className="font-semibold">No computer, printer or scanner? That is fine.</span> The volunteer coordinator is happy to sit down with you and do it together. Just get in touch.
          <a href={`mailto:${ORG.coordinatorEmail}?subject=${encodeURIComponent("Help with my Ministry of Justice check")}`} className="mt-1 flex min-h-11 items-center gap-1.5 font-semibold text-teal hover:underline">
            <Mail className="size-4" aria-hidden /> Ask for a hand
          </a>
        </p>
      </div>
    </>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-display text-sm font-bold text-ink-soft">{children}</span>;
}

function AgreementCard({ a }: { a: AgreementState }) {
  const signed = a.status === "SIGNED";
  return (
    <details className="group rounded-xl border border-border" open={!signed}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">{a.document.title}</span>
          <span className="block text-sm text-muted-foreground">{signed && a.signedAt ? `Signed ${formatDate(todayISO(a.signedAt))}` : a.document.summary}</span>
        </span>
        {a.status === "UPDATED" && <Chip tone="warn" size="sm">Updated</Chip>}
        <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
      </summary>
      <div className="border-t border-border p-3">
        {a.status === "UPDATED" && a.document.versionNote && <p className="mb-3 rounded-lg bg-status-warn-bg p-3 text-sm text-ink"><span className="font-semibold">What changed:</span> {a.document.versionNote}</p>}
        <DocumentFrame title={a.document.title} url={a.document.url} body={a.document.body} />
      </div>
    </details>
  );
}
