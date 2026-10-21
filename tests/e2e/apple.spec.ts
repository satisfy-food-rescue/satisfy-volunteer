import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./support/auth";

// Apple itself cannot take part, so the tests stand in for it at
// appleid.apple.com: a page on Apple's origin that posts back to the
// callback the way Apple does, cross-site. That is the part a browser can
// break, since a cross-site POST carries no SameSite=Lax cookies.

/** Answers Apple's authorization page with an auto-submitting form, as Apple
 *  does once the person has chosen. `state` defaults to the one we sent. */
async function standInForApple(page: Page, answer: { error: string; state?: string }) {
  await page.route("https://appleid.apple.com/auth/authorize**", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    const fields = { state: params.get("state") ?? "", ...answer };
    const inputs = Object.entries(fields)
      .map(([name, value]) => `<input type="hidden" name="${name}" value="${value}">`)
      .join("");
    await route.fulfill({
      contentType: "text/html",
      body: `<form method="post" action="${params.get("redirect_uri")}">${inputs}</form><script>document.forms[0].submit()</script>`,
    });
  });
}

/** Follows the "Continue with Apple" or "Connect Apple" link to Apple.
 *  Playwright only routes the first address of a redirect, so the redirect
 *  is taken with the page's own request context (which shares its cookies)
 *  and Apple's page is then opened directly. */
async function goToApple(page: Page, name: string): Promise<URLSearchParams> {
  const href = await page.getByRole("link", { name }).getAttribute("href");
  const res = await page.request.get(href!, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  const apple = res.headers().location;
  await page.goto(apple);
  return new URL(apple).searchParams;
}

test.describe("Sign in with Apple", () => {
  test("goes to Apple asking only for the email, answered with a form post", async ({ page }) => {
    await standInForApple(page, { error: "user_cancelled_authorize" });
    await page.goto("/sign-in");
    const params = await goToApple(page, "Continue with Apple");
    expect(params.get("client_id")).toBe("nz.org.satisfyfoodrescue.volunteers.e2e");
    expect(params.get("response_type")).toBe("code");
    expect(params.get("response_mode")).toBe("form_post");
    expect(params.get("scope")).toBe("email");
    expect(params.get("redirect_uri")).toMatch(/\/auth\/apple\/callback$/);
    expect(params.get("state")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(params.get("nonce")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await expect(page).toHaveURL(/\/sign-in\?error=apple_cancelled$/);
  });

  test("keeps its round trip across Apple's cross-site post", async ({ page }) => {
    // A cancel with the right state reads as cancelled. Had the round-trip
    // cookies been lost on the way back, the state would not match and it
    // would read as a failure.
    await standInForApple(page, { error: "user_cancelled_authorize" });
    await page.goto("/sign-in");
    await goToApple(page, "Continue with Apple");
    await expect(page.getByRole("alert").filter({ hasText: "Apple sign-in was cancelled." })).toBeVisible();
  });

  test("treats an answer for another round trip as a failure", async ({ page }) => {
    await standInForApple(page, { error: "user_cancelled_authorize", state: "not-the-state-we-sent" });
    await page.goto("/sign-in");
    await goToApple(page, "Continue with Apple");
    await expect(page.getByRole("alert").filter({ hasText: "Apple sign-in did not work just now." })).toBeVisible();
  });

  test("Connect Apple comes back to Sign-in and security still signed in", async ({ page }) => {
    await standInForApple(page, { error: "user_cancelled_authorize" });
    await signInAs(page, "margaret");
    await page.goto("/app/security");
    await expect(page.getByRole("heading", { name: "Apple" })).toBeVisible();
    await goToApple(page, "Connect Apple");
    // Back where they started, so the session cookie made it through the
    // cross-site post too: signed out, they would have landed on sign-in.
    await expect(page).toHaveURL(/\/app\/security\?error=apple_cancelled$/);
    await expect(page.getByText("Apple sign-in was cancelled.")).toBeVisible();
  });
});
