import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Mail, Smartphone } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { formatInstant } from "@/lib/dates";
import { templateByKey } from "@/lib/email-templates";
import { FOOTER_NOTE } from "@/lib/mailer";
import { Chip } from "@/components/shared/status-chip";
import { EmailWordingEditor } from "@/components/admin/email-wording-editor";

export const metadata = { title: "Email wording" };

const AUDIENCE: Record<string, string> = { volunteer: "To volunteers", coordinator: "To coordinators", applicant: "To people who sign up" };

export default async function EmailWordingPage({ params }: { params: Promise<{ key: string }> }) {
  await requireAdmin();
  const { key } = await params;
  const spec = templateByKey(key);
  if (!spec) notFound();
  const custom = await db.emailTemplate.findUnique({ where: { key }, include: { updatedBy: { select: { firstName: true } } } });
  const saved = custom ? { subject: custom.subject, preview: custom.preview, body: custom.body, ctaLabel: custom.ctaLabel ?? undefined } : { subject: spec.subject, preview: spec.preview, body: spec.body, ctaLabel: spec.ctaLabel };
  const push = spec.channel === "PUSH";
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <Link href="/admin/settings" className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-ink"><ChevronLeft className="size-5" aria-hidden /> Emails and import</Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-1.5 flex items-center gap-1.5">{push ? <Smartphone className="size-3.5" aria-hidden /> : <Mail className="size-3.5" aria-hidden />}{push ? "Push notification" : "Email"} · {AUDIENCE[spec.audience]}</p>
          <h1 className="text-3xl text-ink @4xl/admin:text-4xl">{spec.name}</h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">Sent {spec.when.charAt(0).toLowerCase()}{spec.when.slice(1)}</p>
        </div>
        {custom ? (
          <Chip tone="info">Your wording{custom.updatedBy ? `, by ${custom.updatedBy.firstName}` : ""}, {formatInstant(custom.updatedAt)}</Chip>
        ) : (
          <Chip tone="neutral">Standard wording</Chip>
        )}
      </div>
      <EmailWordingEditor
        spec={{ key: spec.key, name: spec.name, channel: spec.channel, placeholders: spec.placeholders, sample: spec.sample, subject: spec.subject, preview: spec.preview, body: spec.body, ctaLabel: spec.ctaLabel }}
        saved={saved}
        custom={custom !== null}
        footerNote={FOOTER_NOTE[spec.audience]}
        signInLink={spec.kind === "ACCOUNT_INVITE" || spec.kind === "PASSWORD_RESET"}
      />
    </div>
  );
}
