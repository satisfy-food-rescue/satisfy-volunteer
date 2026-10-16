import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as mailer from "@/lib/mailer";
import { findUsableToken, sendSignInLink } from "@/lib/auth";
import { makeVolunteer, resetDb } from "./helpers";

function tokenFrom(call: unknown[]) {
  const href = (call[0] as { ctaHref: string }).ctaHref;
  return new URL(href).searchParams.get("token")!;
}

describe("sign-in links", () => {
  beforeEach(resetDb);
  afterEach(() => vi.restoreAllMocks());

  it("email a usable link without storing it", async () => {
    const send = vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
    const v = await makeVolunteer({ firstName: "Jess" });
    expect(await sendSignInLink(v, "INVITE")).toBe(true);
    const raw = tokenFrom(send.mock.calls[0]);
    expect(send.mock.calls[0][0]).toMatchObject({ ctaHref: expect.stringMatching(/^https:\/\/volunteers\.example\.org\/reset-password\?token=/) });

    // Only the hash is kept, and the logged email has no link.
    const stored = await db.authToken.findFirstOrThrow({ where: { volunteerId: v.id } });
    expect(stored.tokenHash).not.toBe(raw);
    const logged = await db.email.findFirstOrThrow({ where: { volunteerId: v.id } });
    expect(logged).toMatchObject({ kind: "ACCOUNT_INVITE", ctaHref: null, status: "SENT" });
    expect(JSON.stringify(logged)).not.toContain(raw);

    expect((await findUsableToken(raw))?.volunteerId).toBe(v.id);
    expect(await findUsableToken("not-a-token")).toBeNull();
  });

  it("revoke the previous link of the same kind", async () => {
    const send = vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
    const v = await makeVolunteer();
    await sendSignInLink(v, "PASSWORD_RESET");
    await sendSignInLink(v, "PASSWORD_RESET");
    const [first, second] = send.mock.calls.map(tokenFrom);
    expect(await findUsableToken(first)).toBeNull();
    expect(await findUsableToken(second)).not.toBeNull();
  });

  it("stop working once expired, used, or the account is deactivated", async () => {
    const send = vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
    const v = await makeVolunteer();
    await sendSignInLink(v, "PASSWORD_RESET");
    const raw = tokenFrom(send.mock.calls[0]);

    await db.volunteer.update({ where: { id: v.id }, data: { status: "INACTIVE" } });
    expect(await findUsableToken(raw)).toBeNull();
    await db.volunteer.update({ where: { id: v.id }, data: { status: "ACTIVE" } });

    await db.authToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await findUsableToken(raw)).toBeNull();
    await db.authToken.updateMany({ data: { expiresAt: new Date(Date.now() + 60_000), usedAt: new Date() } });
    expect(await findUsableToken(raw)).toBeNull();
  });

  it("report a failed send so the coordinator can retry", async () => {
    vi.spyOn(mailer, "sendEmail").mockRejectedValue(new Error("Resend: invalid_from_address"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const v = await makeVolunteer();
    expect(await sendSignInLink(v, "INVITE")).toBe(false);
    expect(await db.email.findFirstOrThrow({ where: { volunteerId: v.id } })).toMatchObject({ status: "FAILED", lastError: expect.stringContaining("invalid_from_address") });
  });
});
