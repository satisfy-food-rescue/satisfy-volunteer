import { createHash, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { findUsableToken } from "@/lib/auth";
import { issueAppSignInCode, redeemAppSignInCode } from "@/lib/mobile-auth";
import { pkceChallenge } from "@/lib/oauth";
import { storeAppChallenge, takeAppChallenge } from "@/lib/webauthn";
import { makeVolunteer, resetDb } from "./helpers";

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

describe("the native app's Google sign-in handoff", () => {
  beforeEach(resetDb);
  afterEach(() => vi.useRealTimers());

  it("redeems once, and only with the app's verifier", async () => {
    const v = await makeVolunteer();
    const { verifier, challenge } = pkce();
    const code = await issueAppSignInCode(v.id, challenge);
    expect((await redeemAppSignInCode(code, verifier))?.id).toBe(v.id);
    expect(await redeemAppSignInCode(code, verifier)).toBeNull();
  });

  it("burns the code on a wrong verifier, so it cannot be guessed at", async () => {
    const v = await makeVolunteer();
    const { verifier, challenge } = pkce();
    const code = await issueAppSignInCode(v.id, challenge);
    expect(await redeemAppSignInCode(code, pkce().verifier)).toBeNull();
    expect(await redeemAppSignInCode(code, verifier)).toBeNull();
  });

  it("expires after two minutes", async () => {
    const v = await makeVolunteer();
    const { verifier, challenge } = pkce();
    const code = await issueAppSignInCode(v.id, challenge);
    await db.authToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await redeemAppSignInCode(code, verifier)).toBeNull();
  });

  it("refuses someone deactivated since", async () => {
    const v = await makeVolunteer();
    const { verifier, challenge } = pkce();
    const code = await issueAppSignInCode(v.id, challenge);
    await db.volunteer.update({ where: { id: v.id }, data: { status: "INACTIVE" } });
    expect(await redeemAppSignInCode(code, verifier)).toBeNull();
  });

  it("can never be used as a password reset link", async () => {
    const v = await makeVolunteer();
    const code = await issueAppSignInCode(v.id, pkce().challenge);
    expect(await findUsableToken(code)).toBeNull();
  });

  it("uses the RFC 7636 S256 challenge", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("passkey challenges for the native app", () => {
  beforeEach(resetDb);

  it("answer once, for the ceremony they were issued for", async () => {
    const id = await storeAppChallenge("authentication", "abc", null);
    expect(await takeAppChallenge("registration", id, null)).toBeNull();
    expect(await takeAppChallenge("authentication", id, null)).toBe("abc");
    expect(await takeAppChallenge("authentication", id, null)).toBeNull();
  });

  it("a registration challenge only answers for its volunteer", async () => {
    const [a, b] = [await makeVolunteer(), await makeVolunteer()];
    const id = await storeAppChallenge("registration", "xyz", a.id);
    expect(await takeAppChallenge("registration", id, b.id)).toBeNull();
    expect(await takeAppChallenge("registration", id, a.id)).toBe("xyz");
  });

  it("expire after five minutes", async () => {
    const id = await storeAppChallenge("authentication", "abc", null);
    await db.passkeyChallenge.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await takeAppChallenge("authentication", id, null)).toBeNull();
  });
});
