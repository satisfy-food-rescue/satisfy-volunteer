import Link from "next/link";
import { ExternalLink, FileSignature, FileText } from "lucide-react";
import { documentEmbedUrl, documentSiteLabel } from "@satisfy/core/documents";
import type { Document } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { ACTIVE_POOL } from "@/lib/pool";
import { formatDate, todayISO } from "@/lib/dates";
import { ROLE_SHORT, fullName } from "@/lib/domain";
import { documentIsFor } from "@/lib/documents";
import { PageHeader } from "@/components/shared/page-header";
import { Chip } from "@/components/shared/status-chip";
import { Disclosure } from "@/components/admin/disclosure";
import { ArchiveDocumentButton, DocumentEditor, PublishVersionButton } from "@/components/admin/document-controls";

export const metadata = { title: "Policies and agreements" };

type Person = { id: string; firstName: string; lastName: string | null; roles: string[] };

export default async function PoliciesAdminPage() {
  await requireAdmin();
  const [documents, pool] = await Promise.all([
    db.document.findMany({ include: { acknowledgements: { select: { volunteerId: true, version: true } } }, orderBy: [{ archived: "asc" }, { order: "asc" }, { createdAt: "asc" }] }),
    db.volunteer.findMany({ where: ACTIVE_POOL, select: { id: true, firstName: true, lastName: true, roles: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
  ]);
  const agreements = documents.filter((d) => d.kind === "AGREEMENT");
  const policies = documents.filter((d) => d.kind === "POLICY");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        eyebrow="Set-up"
        title="Policies and agreements"
        description="The board's documents stay in Google Drive, the single source of truth, and volunteers read them inside the app. Edits in Drive show straight away; publish a new version here when volunteers need to read or sign it again."
      />

      <Section
        icon={FileSignature}
        title="Agreements"
        intro="Signed with a tick box on the volunteer's induction page, before training or shifts. The volunteer and confidentiality agreements go here."
        action={<DocumentEditor kind="AGREEMENT" />}
        docs={agreements}
        pool={pool}
        empty="No agreements yet."
      />
      <Section
        icon={FileText}
        title="Policies"
        intro="Under Policies in the volunteer app, to read at any time. Publishing a new version asks volunteers to read it and tick to confirm."
        action={<DocumentEditor kind="POLICY" />}
        docs={policies}
        pool={pool}
        empty="No policies yet."
      />
    </div>
  );
}

function Section({ icon: Icon, title, intro, action, docs, pool, empty }: { icon: React.ComponentType<{ className?: string }>; title: string; intro: string; action: React.ReactNode; docs: (Document & { acknowledgements: { volunteerId: string; version: number }[] })[]; pool: Person[]; empty: string }) {
  const id = title.toLowerCase();
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${id}-h`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-h`} className="flex items-center gap-2 text-2xl text-ink"><Icon className="size-6 text-teal" aria-hidden />{title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{intro}</p>
        </div>
      </div>
      <div className="self-start">{action}</div>
      {docs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-muted-foreground">{empty}</p>
      ) : (
        docs.map((d) => <DocumentCard key={d.id} d={d} pool={pool} />)
      )}
    </section>
  );
}

function DocumentCard({ d, pool }: { d: Document & { acknowledgements: { volunteerId: string; version: number }[] }; pool: Person[] }) {
  const agreement = d.kind === "AGREEMENT";
  const audience = pool.filter((v) => documentIsFor(d, v.roles));
  const current = new Set(d.acknowledgements.filter((a) => a.version === d.version).map((a) => a.volunteerId));
  const done = audience.filter((v) => current.has(v.id));
  const waiting = audience.filter((v) => !current.has(v.id));
  const pct = audience.length ? Math.round((done.length / audience.length) * 100) : 100;
  return (
    <article className={d.archived ? "rounded-2xl border border-dashed border-border bg-card/60 p-4" : "rounded-2xl border border-border bg-card p-4"}>
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1 basis-72">
          <h3 className="flex flex-wrap items-center gap-2 text-xl text-ink">
            {d.title}
            {d.archived && <Chip tone="muted" size="sm">Archived</Chip>}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{d.summary}</p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
            <span><span className="font-semibold text-ink">Version {d.version}</span>, {d.version > 1 ? "published" : "added"} {formatDate(todayISO(d.versionAt))}</span>
            <span>{d.roles.length === 0 ? "For everyone" : `${agreement ? "Signed by" : "For"} ${d.roles.map((r) => ROLE_SHORT[r].toLowerCase()).join(", ")}`}</span>
            {d.url && (
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-teal hover:underline">
                {documentSiteLabel(d.url)} <ExternalLink className="size-3.5" aria-hidden />
                {!documentEmbedUrl(d.url) && <span className="font-normal text-muted-foreground">(opens outside the app)</span>}
              </a>
            )}
          </p>
          {d.versionNote && <p className="mt-2 text-sm text-ink-soft"><span className="font-semibold">What changed:</span> {d.versionNote}</p>}
        </div>
        {!d.archived && (
          <div className="w-full @xl/admin:w-64">
            <p className="mb-1 flex justify-between text-xs font-semibold text-muted-foreground"><span>{audience.length} volunteers</span><span className="tabular">{pct}% {agreement ? "signed" : "read"}</span></p>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${done.length} of ${audience.length} have ${agreement ? "signed" : "read"} version ${d.version}`}>
              {done.length > 0 && <span className="bg-green" style={{ width: `${pct}%` }} />}
            </div>
            <p className="mt-1 text-xs font-semibold tabular text-ink-soft">{done.length} of {audience.length} {agreement ? "signed" : "read"} version {d.version}</p>
          </div>
        )}
      </div>
      {!d.archived && waiting.length > 0 && (
        <Disclosure size="sm" className="mt-3" label={`${waiting.length} still to ${agreement ? "sign" : "read"}`}>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {waiting.map((v) => (
              <li key={v.id}><Link href={`/admin/volunteers/${v.id}`} className="font-semibold text-ink hover:underline">{fullName(v)}</Link></li>
            ))}
          </ul>
        </Disclosure>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {!d.archived && <PublishVersionButton id={d.id} title={d.title} agreement={agreement} nextVersion={d.version + 1} audience={audience.length} />}
        {!d.archived && <DocumentEditor kind={d.kind} document={{ id: d.id, kind: d.kind, title: d.title, summary: d.summary, url: d.url ?? "", body: d.body ?? "", roles: d.roles }} />}
        <ArchiveDocumentButton id={d.id} title={d.title} archived={d.archived} agreement={agreement} />
      </div>
    </article>
  );
}
