import Link from "next/link";
import { CheckCircle2, ChevronRight, FileSignature, FileText } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { documentsFor, type VolunteerDocument } from "@/lib/documents";
import { DOCUMENTS_TITLE } from "@/lib/domain";
import { AppPage, AppPageHeader } from "@/components/app/app-page-header";
import { Chip } from "@/components/shared/status-chip";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: DOCUMENTS_TITLE };

export default async function PoliciesPage() {
  const me = await requireVolunteer();
  const docs = await documentsFor(me);
  const agreements = docs.filter((d) => d.document.kind === "AGREEMENT");
  const policies = docs.filter((d) => d.document.kind === "POLICY");
  return (
    <AppPage className="pt-3">
      <AppPageHeader
        back={{ href: "/app/profile", label: "Me", tabBarOnly: true }}
        eyebrow="Health, safety and how we work"
        title={DOCUMENTS_TITLE}
        description="The agreements from your induction and Satisfy's policies, always the latest version. When one changes, we ask you to read it and tick to confirm."
      />
      {docs.length === 0 ? (
        <EmptyState icon={FileText} title="Nothing here yet" description="The coordinator adds agreements and policies here as they are published." />
      ) : (
        <div className="flex flex-col gap-8 @4xl/app:grid @4xl/app:grid-cols-2 @4xl/app:items-start @4xl/app:gap-8">
          {agreements.length > 0 && (
            <section aria-labelledby="agr-h">
              <h2 id="agr-h" className="mb-2 text-xl text-ink">Your agreements</h2>
              <DocList docs={agreements} />
            </section>
          )}
          {policies.length > 0 && (
            <section aria-labelledby="pol-h">
              <h2 id="pol-h" className="mb-2 text-xl text-ink">Policies</h2>
              <DocList docs={policies} />
            </section>
          )}
        </div>
      )}
    </AppPage>
  );
}

function DocList({ docs }: { docs: VolunteerDocument[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {docs.map(({ document: d, readAt, needsAction }) => {
        const agreement = d.kind === "AGREEMENT";
        const signs = agreement && d.acceptance !== "READ";
        return (
          <li key={d.id}>
            <Link href={`/app/policies/${d.id}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm transition-colors hover:border-teal/60">
              {agreement ? <FileSignature className="size-5 shrink-0 text-teal" aria-hidden /> : <FileText className="size-5 shrink-0 text-teal" aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{d.title}</span>
                <span className="block text-sm text-muted-foreground">
                  {needsAction
                    ? d.version > 1 ? `Updated ${formatDate(todayISO(d.versionAt))}` : d.summary
                    : signs ? `Signed ${formatDate(todayISO(readAt!))}` : agreement ? `Read and understood ${formatDate(todayISO(readAt!))}` : `Read ${formatDate(todayISO(readAt!))}`}
                </span>
              </span>
              {needsAction ? (
                <Chip tone={agreement ? "info" : "warn"} size="sm" className="shrink-0">{signs ? "To sign" : agreement ? "To read" : d.version > 1 ? "Updated" : "To read"}</Chip>
              ) : (
                <CheckCircle2 className="size-5 shrink-0 text-status-good" aria-label={signs ? "Signed" : "Read"} />
              )}
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
