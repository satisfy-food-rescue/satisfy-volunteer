import { Fragment } from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "react-email";

// The one email layout every message uses: brand header, paragraphs, at most
// one call to action, quiet footer. Mirrors the Outbox preview in
// src/app/admin/outbox/[id]/page.tsx. Email clients support neither CSS
// variables nor web fonts reliably, so the brand tokens from globals.css are
// repeated here as hex. Keep them in step.
const BRAND = {
  teal: "#106379",
  green: "#00a651",
  orange50: "#f0ba84",
  ink: "#10303a",
  muted: "#52676f",
  canvas: "#f3f7f8",
  backdrop: "#e3edf0",
};

// Montserrat is the brand face; clients without it fall back to Helvetica.
const FONT = "Montserrat, 'Helvetica Neue', Helvetica, Arial, sans-serif";

export type MessageEmailProps = {
  preview: string;
  /** Paragraphs separated by blank lines; single newlines are kept. */
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  logoUrl: string;
  orgName: string;
  orgBase: string;
  /** Why the reader is getting this, shown in the footer. */
  footerNote: string;
};

export function MessageEmail({ preview, body, ctaLabel, ctaUrl, logoUrl, orgName, orgBase, footerNote }: MessageEmailProps) {
  const paragraphs = body.split("\n\n");
  return (
    <Html lang="en-NZ">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: BRAND.backdrop, margin: 0, padding: "24px 12px", fontFamily: FONT }}>
        <Container style={{ maxWidth: 560, backgroundColor: "#ffffff", borderRadius: 12, overflow: "hidden" }}>
          <Section style={{ backgroundColor: BRAND.teal, padding: "24px", textAlign: "center" }}>
            <Img src={logoUrl} width={67} height={64} alt={orgName} style={{ display: "inline-block" }} />
          </Section>
          <Section style={{ padding: "24px" }}>
            {paragraphs.map((p, i) => (
              <Text key={i} style={{ fontSize: 17, lineHeight: "26px", color: BRAND.ink, margin: "0 0 16px" }}>
                {p.split("\n").map((line, j) => (
                  <Fragment key={j}>
                    {j > 0 && <br />}
                    {line}
                  </Fragment>
                ))}
              </Text>
            ))}
            {ctaLabel && ctaUrl && (
              <Section style={{ margin: "24px 0 8px" }}>
                <Button
                  href={ctaUrl}
                  style={{
                    backgroundColor: BRAND.teal,
                    color: "#ffffff",
                    fontFamily: FONT,
                    fontWeight: 700,
                    fontSize: 16,
                    borderRadius: 999,
                    padding: "12px 24px",
                    textDecoration: "none",
                  }}
                >
                  {ctaLabel}
                </Button>
              </Section>
            )}
          </Section>
          {/* The brand ribbons, as a simple three-colour rule. */}
          <Section>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ height: 4, backgroundColor: BRAND.teal }} />
                  <td style={{ height: 4, backgroundColor: BRAND.orange50 }} />
                  <td style={{ height: 4, backgroundColor: BRAND.green }} />
                </tr>
              </tbody>
            </table>
          </Section>
          <Section style={{ backgroundColor: BRAND.canvas, padding: "16px 24px" }}>
            <Text style={{ fontSize: 13, lineHeight: "20px", color: BRAND.muted, margin: 0 }}>
              {orgName} · {orgBase}
            </Text>
            <Text style={{ fontSize: 13, lineHeight: "20px", color: BRAND.muted, margin: 0 }}>{footerNote}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
