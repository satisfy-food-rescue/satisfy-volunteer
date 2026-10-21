import { beforeEach, describe, expect, it } from "vitest";
import { APPLE, type AppleIdentity } from "@/lib/apple";
import { db } from "@/lib/db";
import { GOOGLE } from "@/lib/oauth";
import { connectApple, disconnectProvider, signInWithApple, signInWithGoogle } from "@/lib/sign-in";
import { makeVolunteer, resetDb } from "./helpers";

const RELAY = "x7k2@privaterelay.appleid.com";

function apple(over: Partial<AppleIdentity> = {}): AppleIdentity {
  return { sub: "001.apple", email: null, emailVerified: true, privateEmail: false, ...over };
}

describe("Sign in with Apple", () => {
  beforeEach(resetDb);

  it("matches a volunteer by the email Apple shares, links Apple and verifies the address", async () => {
    const v = await makeVolunteer({ email: "margaret@example.nz" });
    const result = await signInWithApple(apple({ email: "margaret@example.nz" }));
    expect(result).toMatchObject({ ok: true, volunteer: { id: v.id } });
    expect(await db.oAuthAccount.findFirst({ where: { provider: APPLE, providerAccountId: "001.apple" } })).toMatchObject({ volunteerId: v.id });
    expect((await db.volunteer.findUniqueOrThrow({ where: { id: v.id } })).emailVerifiedAt).not.toBeNull();
  });

  it("then signs in by Apple's id alone, even with the email hidden", async () => {
    const v = await makeVolunteer({ email: "margaret@example.nz" });
    await signInWithApple(apple({ email: "margaret@example.nz" }));
    expect(await signInWithApple(apple({ email: null }))).toMatchObject({ ok: true, volunteer: { id: v.id } });
  });

  it("says why when a hidden email matches nobody, and when a shared one does not", async () => {
    await makeVolunteer({ email: "margaret@example.nz" });
    expect(await signInWithApple(apple({ email: RELAY, privateEmail: true }))).toEqual({ ok: false, reason: "apple_private" });
    expect(await signInWithApple(apple({ email: "someone@else.nz" }))).toEqual({ ok: false, reason: "apple_unknown" });
    expect(await signInWithApple(apple({ email: null }))).toEqual({ ok: false, reason: "apple_unknown" });
    expect(await db.oAuthAccount.count()).toBe(0);
  });

  it("never matches an address Apple has not verified", async () => {
    await makeVolunteer({ email: "margaret@example.nz" });
    expect(await signInWithApple(apple({ email: "margaret@example.nz", emailVerified: false }))).toEqual({ ok: false, reason: "apple_unknown" });
    expect(await db.oAuthAccount.count()).toBe(0);
  });

  it("refuses someone no longer active, linked or not", async () => {
    const v = await makeVolunteer({ email: "margaret@example.nz" });
    await db.volunteer.update({ where: { id: v.id }, data: { status: "INACTIVE" } });
    expect(await signInWithApple(apple({ email: "margaret@example.nz" }))).toEqual({ ok: false, reason: "inactive" });
    await db.oAuthAccount.create({ data: { volunteerId: v.id, provider: APPLE, providerAccountId: "001.apple" } });
    expect(await signInWithApple(apple())).toEqual({ ok: false, reason: "inactive" });
  });

  it("keeps the stored address current", async () => {
    const v = await makeVolunteer({ email: "margaret@example.nz" });
    await db.oAuthAccount.create({ data: { volunteerId: v.id, provider: APPLE, providerAccountId: "001.apple", email: RELAY } });
    await signInWithApple(apple({ email: "margaret@example.nz" }));
    expect((await db.oAuthAccount.findFirstOrThrow({ where: { provider: APPLE } })).email).toBe("margaret@example.nz");
  });

  it("is a separate link from Google for the same person", async () => {
    const v = await makeVolunteer({ email: "margaret@example.nz" });
    await signInWithGoogle({ sub: "g-1", email: "margaret@example.nz", emailVerified: true });
    await signInWithApple(apple({ email: "margaret@example.nz" }));
    expect((await db.oAuthAccount.findMany({ where: { volunteerId: v.id }, orderBy: { provider: "asc" } })).map((a) => a.provider)).toEqual([APPLE, GOOGLE]);
  });
});

describe("Connect Apple", () => {
  beforeEach(resetDb);

  it("links a hidden email to whoever is signed in, so Apple sign-in works from then on", async () => {
    const v = await makeVolunteer({ email: "margaret@example.nz" });
    expect(await connectApple(v, apple({ email: RELAY, privateEmail: true }))).toBe("connected");
    expect(await signInWithApple(apple({ email: RELAY, privateEmail: true }))).toMatchObject({ ok: true, volunteer: { id: v.id } });
    expect(await connectApple(v, apple({ email: RELAY, privateEmail: true }))).toBe("connected");
  });

  it("will not take an Apple Account from someone else, or add a second one", async () => {
    const [a, b] = [await makeVolunteer(), await makeVolunteer()];
    await connectApple(a, apple());
    expect(await connectApple(b, apple())).toBe("apple_taken");
    expect(await connectApple(a, apple({ sub: "001.other" }))).toBe("apple_exists");
  });

  it("disconnects only Apple", async () => {
    const v = await makeVolunteer({ email: "margaret@example.nz" });
    await signInWithGoogle({ sub: "g-1", email: "margaret@example.nz", emailVerified: true });
    await connectApple(v, apple());
    await disconnectProvider(v, APPLE);
    expect((await db.oAuthAccount.findMany({ where: { volunteerId: v.id } })).map((a) => a.provider)).toEqual([GOOGLE]);
  });
});
