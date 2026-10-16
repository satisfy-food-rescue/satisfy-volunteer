import { expect, test } from "@playwright/test";
import { signInAs } from "./support/auth";

// A virtual authenticator (Chrome DevTools Protocol) stands in for Face ID or
// a fingerprint reader, so the whole ceremony runs for real.
test("add a passkey, then sign in with it", async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });

  await signInAs(page, "margaret");
  await page.goto("/app/security");
  await page.getByRole("button", { name: "Add a passkey on this device" }).click();
  await expect(page.getByText("Passkey added")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(1);

  await page.goto("/app/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(page).toHaveURL(/\/app$/);
});
