import "server-only";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { MessageEmail } from "@/emails/message-email";
import { ORG } from "./brand";
import { absoluteUrl, env } from "./env";

// Transactional email through Resend. With EMAIL_DELIVERY=log, or without
// RESEND_API_KEY in development, the plain-text version is printed to the
// console instead. Production refuses to start without a key unless logging
// was chosen explicitly (see env.ts), so nothing is silently dropped.

let client: Resend | null | undefined;
function resend(): Resend | null {
  if (client === undefined) {
    const { RESEND_API_KEY: key, EMAIL_DELIVERY } = env();
    client = key && EMAIL_DELIVERY === "resend" ? new Resend(key) : null;
  }
  return client;
}

export type OutgoingEmail = {
  to: string;
  toName: string;
  subject: string;
  preview: string;
  body: string;
  ctaLabel?: string | null;
  /** App-relative path or absolute URL. */
  ctaHref?: string | null;
  /** Coordinator alerts say so in the footer instead of the volunteer note. */
  audience: "volunteer" | "coordinator";
  /** Stable per message, so a retried send is not delivered twice. */
  idempotencyKey: string;
};

export async function renderEmail(m: Omit<OutgoingEmail, "to" | "toName" | "idempotencyKey">) {
  const element = MessageEmail({
    preview: m.preview,
    body: m.body,
    ctaLabel: m.ctaLabel,
    ctaUrl: m.ctaHref ? absoluteUrl(m.ctaHref) : null,
    logoUrl: absoluteUrl("/email/logo.png"),
    orgName: ORG.name,
    orgBase: ORG.base,
    footerNote:
      m.audience === "coordinator"
        ? "Sent to the volunteer coordinator by the Satisfy volunteer app."
        : "You are receiving this because you volunteer with Satisfy. Reply to this email to reach the volunteer coordinator.",
  });
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { html, text };
}

/** Sends one email. Returns the provider's message id; throws on failure. */
export async function sendEmail(m: OutgoingEmail): Promise<string> {
  const { html, text } = await renderEmail(m);
  const e = env();
  const mail = resend();
  if (!mail) {
    console.log(`\n[email] to ${m.toName} <${m.to}>\n  subject: ${m.subject}\n${text}\n`);
    return "console";
  }
  const { data, error } = await mail.emails.send(
    {
      from: e.EMAIL_FROM,
      to: `${m.toName.replace(/[<>"]/g, "")} <${m.to}>`,
      replyTo: e.COORDINATOR_EMAIL,
      subject: m.subject,
      html,
      text,
    },
    { idempotencyKey: m.idempotencyKey },
  );
  if (error || !data) throw new Error(`Resend: ${error?.name ?? "unknown"}: ${error?.message ?? "no response"}`);
  return data.id;
}
