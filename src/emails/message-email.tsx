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
} from "@react-email/components";

// The one email layout every message uses: brand header, paragraphs, at most
// one call to action, quiet footer. Mirrors the Outbox preview in
// src/app/admin/outbox/[id]/page.tsx. Email clients support neither CSS
// variables nor web fonts reliably, so the brand tokens from globals.css are
// repeated here as hex. Keep them in step.
const BRAND = {
  greenFill: "#008543",
  greenText: "#007a3d",
  brandGreen: "#00a551",
  ink: "#1c2a22",
  muted: "#566159",
  canvas: "#f5faf7",
  backdrop: "#e9f1ec",
  border: "#dbe6df",
};

const FONT = "Montserrat, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const BODY_FONT = "'Roboto Slab', Georgia, 'Times New Roman', serif";

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
      <Body style={{ backgroundColor: BRAND.backdrop, margin: 0, padding: "24px 12px", fontFamily: BODY_FONT }}>
        <Container style={{ maxWidth: 560, backgroundColor: "#ffffff", borderRadius: 12, overflow: "hidden" }}>
          <Section style={{ padding: "20px 24px", borderBottom: `4px solid ${BRAND.brandGreen}` }}>
            <Img src={logoUrl} width={56} height={56} alt={orgName} style={{ display: "block" }} />
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
                    backgroundColor: BRAND.greenFill,
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
          <Section style={{ backgroundColor: BRAND.canvas, padding: "16px 24px", borderTop: `1px solid ${BRAND.border}` }}>
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
