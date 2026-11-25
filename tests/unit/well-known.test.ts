import { describe, expect, it, vi } from "vitest";

// The native app has a different identity on each store, so each platform's
// passkey association names its own: the Android package in assetlinks.json,
// the iOS bundle id in apple-app-site-association.

const FINGERPRINT = Array.from({ length: 32 }, () => "AB").join(":");

vi.mock("@/lib/env", () => ({
  env: () => ({ ANDROID_CERT_FINGERPRINTS: [FINGERPRINT], APPLE_TEAM_ID: "ABCDE12345" }),
}));

const { GET: assetLinks } = await import("@/app/.well-known/assetlinks.json/route");
const { GET: appleAssociation } = await import("@/app/.well-known/apple-app-site-association/route");

describe("passkey associations", () => {
  it("names the Android package in assetlinks.json", async () => {
    const [statement] = await assetLinks().json();
    expect(statement.target).toEqual({
      namespace: "android_app",
      package_name: "nz.org.satisfyfoodrescue",
      sha256_cert_fingerprints: [FINGERPRINT],
    });
  });

  it("names the iOS bundle id in apple-app-site-association", async () => {
    const body = await appleAssociation().json();
    expect(body).toEqual({ webcredentials: { apps: ["ABCDE12345.nz.org.satisfyfoodrescue.volunteers"] } });
  });
});
