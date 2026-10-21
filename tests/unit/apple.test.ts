import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTVerifyGetKey } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { isAppleRelay, readAppleNotification, verifyAppleIdToken, verifyNativeAppleSignIn } from "@/lib/apple";
import { NATIVE_APP_ID } from "@/lib/native-app";
import { pkceChallenge } from "@/lib/oauth";

// Apple signs with RS256. A local key set stands in for Apple's published
// keys.

const ISSUER = "https://appleid.apple.com";
const AUDIENCE = "nz.org.satisfyfoodrescue.volunteers.web";
let keys: JWTVerifyGetKey;
let sign: (claims: Record<string, unknown>, opts?: { issuer?: string; audience?: string; expiresIn?: string }) => Promise<string>;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: "test", alg: "RS256" }] });
  sign = (claims, opts = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer(opts.issuer ?? ISSUER)
      .setAudience(opts.audience ?? AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(opts.expiresIn ?? "10m")
      .sign(privateKey);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Apple ID tokens", () => {
  const nonce = pkceChallenge("a-verifier-that-never-left-the-browser-or-app");

  it("give the identity, with Apple's string booleans", async () => {
    const token = await sign({ sub: "001.abc", nonce, email: "Margaret@Example.NZ", email_verified: "true", is_private_email: "false" });
    expect(await verifyAppleIdToken(token, { audience: AUDIENCE, nonce }, keys)).toEqual({
      sub: "001.abc",
      email: "margaret@example.nz",
      emailVerified: true,
      privateEmail: false,
    });
  });

  it("mark a relay address as private, with or without the claim", async () => {
    const token = await sign({ sub: "001.abc", nonce, email: "x7k2@privaterelay.appleid.com", email_verified: true });
    expect((await verifyAppleIdToken(token, { audience: AUDIENCE, nonce }, keys)).privateEmail).toBe(true);
    expect(isAppleRelay("x7k2@privaterelay.appleid.com")).toBe(true);
    expect(isAppleRelay("margaret@example.nz")).toBe(false);
    expect(isAppleRelay(null)).toBe(false);
  });

  it("may leave the email out", async () => {
    const token = await sign({ sub: "001.abc", nonce });
    expect(await verifyAppleIdToken(token, { audience: AUDIENCE, nonce }, keys)).toMatchObject({ email: null, emailVerified: false, privateEmail: false });
  });

  it("are refused with the wrong nonce or none", async () => {
    await expect(verifyAppleIdToken(await sign({ sub: "001.abc", nonce: "other" }), { audience: AUDIENCE, nonce }, keys)).rejects.toThrow("invalid_claims");
    await expect(verifyAppleIdToken(await sign({ sub: "001.abc" }), { audience: AUDIENCE, nonce }, keys)).rejects.toThrow("invalid_claims");
  });

  it("are refused for another client, issuer or when expired", async () => {
    const expected = { audience: AUDIENCE, nonce };
    await expect(verifyAppleIdToken(await sign({ sub: "s", nonce }, { audience: "host.exp.Exponent" }), expected, keys)).rejects.toThrow("invalid_claims");
    await expect(verifyAppleIdToken(await sign({ sub: "s", nonce }, { issuer: "https://evil.example" }), expected, keys)).rejects.toThrow("invalid_claims");
    await expect(verifyAppleIdToken(await sign({ sub: "s", nonce }, { expiresIn: "-1m" }), expected, keys)).rejects.toThrow("invalid_claims");
  });

  it("are refused when signed by someone else", async () => {
    const { privateKey } = await generateKeyPair("RS256");
    const forged = await new SignJWT({ sub: "s", nonce }).setProtectedHeader({ alg: "RS256", kid: "test" }).setIssuer(ISSUER).setAudience(AUDIENCE).setExpirationTime("10m").sign(privateKey);
    await expect(verifyAppleIdToken(forged, { audience: AUDIENCE, nonce }, keys)).rejects.toThrow("invalid_claims");
  });

  it("from the iOS app are for its bundle id, carrying the S256 hash of the app's nonce", async () => {
    const raw = "the-apps-own-random-nonce-of-at-least-43-characters";
    const token = await sign({ sub: "001.abc", nonce: pkceChallenge(raw), email: "tony@example.nz" }, { audience: NATIVE_APP_ID });
    expect((await verifyNativeAppleSignIn(token, raw, keys)).sub).toBe("001.abc");
    // The raw nonce in the token, or a token for the website, does not do.
    await expect(verifyNativeAppleSignIn(await sign({ sub: "001.abc", nonce: raw }, { audience: NATIVE_APP_ID }), raw, keys)).rejects.toThrow("invalid_claims");
    await expect(verifyNativeAppleSignIn(await sign({ sub: "001.abc", nonce: pkceChallenge(raw) }), raw, keys)).rejects.toThrow("invalid_claims");
  });
});

describe("Apple's server-to-server notifications", () => {
  it("give the event, whose claims arrive as a JSON string", async () => {
    const events = JSON.stringify({ type: "consent-revoked", sub: "001.abc", event_time: 1 });
    const payload = await sign({ events }, { audience: NATIVE_APP_ID });
    expect(await readAppleNotification(payload, keys)).toEqual({ type: "consent-revoked", sub: "001.abc", email: null });
  });

  it("carry the relay address for email events", async () => {
    const events = { type: "email-disabled", sub: "001.abc", email: "x7k2@privaterelay.appleid.com", is_private_email: "true" };
    const payload = await sign({ events }, { audience: NATIVE_APP_ID });
    expect(await readAppleNotification(payload, keys)).toEqual({ type: "email-disabled", sub: "001.abc", email: "x7k2@privaterelay.appleid.com" });
  });

  it("ignore events we do not act on", async () => {
    const payload = await sign({ events: JSON.stringify({ type: "something-new", sub: "s" }) }, { audience: NATIVE_APP_ID });
    expect(await readAppleNotification(payload, keys)).toBeNull();
  });

  it("are refused for another app", async () => {
    const payload = await sign({ events: JSON.stringify({ type: "account-delete", sub: "s" }) }, { audience: "com.example.other" });
    await expect(readAppleNotification(payload, keys)).rejects.toThrow("invalid_claims");
  });
});
