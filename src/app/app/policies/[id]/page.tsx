import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, FileSignature } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { documentsFor } from "@/lib/documents";
import { AppPage, AppPageHeader } from "@/components/app/app-page-header";
import { DocumentFrame } from "@/components/shared/document-frame";
import { AcknowledgeDocument } from "@/components/app/acknowledge-document";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Policy" };

export default async function PolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireVolunteer();
  const { id } = await params;
  const found = (await documentsFor(me)).find((d) => d.document.id === id);
  if (!found) notFound();
  const { document: d, readAt, readVersion, needsAction } = found;
  const agreement = d.kind === "AGREEMENT";
  const updated = needsAction && readVersion !== null;

  return (
    <AppPage className="pt-3">
      <AppPageHeader back={{ href: "/app/policies", label: "Policies" }} eyebrow={agreement ? "Agreement" : "Policy"} title={d.title} description={d.summary} />
      <div className="flex max-w-[60rem] flex-col gap-4">
        {updated && d.versionNote && (
          <p className="rounded-xl bg-status-warn-bg p-4 text-ink ring-1 ring-status-warn/20">
            <span className="font-semibold">Updated {formatDate(todayISO(d.versionAt))}.</span> {d.versionNote}
          </p>
        )}
        <DocumentFrame title={d.title} url={d.url} body={d.body} />
        {!needsAction ? (
          <p className="flex items-center gap-2 font-semibold text-green-text">
            <CheckCircle2 className="size-5" aria-hidden />
            {agreement ? "You signed this" : "You confirmed you read this"} on {formatDate(todayISO(readAt!))}.
          </p>
        ) : agreement ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-teal/40 bg-teal-tint-soft p-4">
            <p className="text-ink">{updated ? "This agreement has been updated. Please sign the new version." : "You have not signed this yet."} Agreements are signed together on your induction page.</p>
            <Button className="h-12 text-base @3xl/app:self-start @3xl/app:px-8" render={<Link href="/app/induction" />}>
              <FileSignature className="size-5" aria-hidden /> Read and sign
            </Button>
          </div>
        ) : (
          <AcknowledgeDocument documentId={d.id} version={d.version} title={d.title} updated={updated} />
        )}
      </div>
    </AppPage>
  );
}
