import { expect, test } from "@playwright/test";
import { PEOPLE, signIn, signInAs } from "./support/auth";
import { issueSignInLink } from "./support/db";

test.describe("password sign-in", () => {
  test("rejects a wrong password without saying whether the account exists", async ({ page }) => {
    await page.goto("/sign-in");
    await signIn(page, PEOPLE.margaret, "not-her-password");
    await expect(page.getByRole("alert").filter({ hasText: "That email and password do not match" })).toBeVisible();
    await signIn(page, "nobody@example.nz", "whatever-it-is");
    await expect(page.getByRole("alert").filter({ hasText: "That email and password do not match" })).toBeVisible();
  });

  test("returns to the page a link pointed at", async ({ page }) => {
    await page.goto("/app/training");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp%2Ftraining$/);
    await signIn(page, PEOPLE.margaret);
    await expect(page).toHaveURL(/\/app\/training$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("keeps volunteers out of the coordinator area", async ({ page }) => {
    await signInAs(page, "margaret");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/app$/);
  });

  test("signs out", async ({ page }) => {
    await signInAs(page, "margaret");
    await page.goto("/app/profile");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("sign-in links", () => {
  test("first-time volunteers set a password from their invite", async ({ page }) => {
    const link = await issueSignInLink(PEOPLE.jess, "INVITE");
    await page.goto(link);
    await expect(page.getByRole("heading", { name: "Welcome, Jess" })).toBeVisible();

    await page.getByLabel("New password").fill("a-short-phrase");
    await page.getByLabel("Type it again").fill("a-short-phrase");
    await page.getByRole("button", { name: "Set password and sign in" }).click();
    await expect(page).toHaveURL(/\/app$/);

    // The link only works once.
    await page.context().clearCookies();
    await page.goto(link);
    await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();

    // And the new password works.
    await page.goto("/sign-in");
    await signIn(page, PEOPLE.jess, "a-short-phrase");
    await expect(page).toHaveURL(/\/app$/);
  });

  test("asking for a link gives the same answer for any address", async ({ page }) => {
    for (const email of [PEOPLE.tony, "stranger@example.nz"]) {
      await page.goto("/forgot-password");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByRole("button", { name: "Email me a link" }).click();
      await expect(page.getByText("Check your email")).toBeVisible();
      await expect(page.getByText(`If ${email} belongs to a Satisfy volunteer`)).toBeVisible();
    }
  });

  test("a short password is refused", async ({ page }) => {
    await page.goto(await issueSignInLink(PEOPLE.tony, "PASSWORD_RESET"));
    await page.getByLabel("New password").fill("short");
    await page.getByLabel("Type it again").fill("short");
    // Bypass the browser's own minlength check to exercise the server rule.
    await page.locator("form").evaluate((f: HTMLFormElement) => (f.noValidate = true));
    await page.getByRole("button", { name: "Save and sign in" }).click();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
  });
});
