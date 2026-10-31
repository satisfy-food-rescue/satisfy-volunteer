import { expect, test } from "@playwright/test";
import { PEOPLE, signIn, signInAs } from "./support/auth";
import { createVolunteer, issueSignInLink } from "./support/db";

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

  test("volunteers can delete their own account", async ({ page }) => {
    const email = "leaving.soon@example.nz";
    await createVolunteer("Leaving", email);
    await page.goto(await issueSignInLink(email, "INVITE"));
    await page.getByLabel("New password").fill("a-short-phrase");
    await page.getByLabel("Type it again").fill("a-short-phrase");
    await page.getByRole("button", { name: "Set password and sign in" }).click();
    await expect(page).toHaveURL(/\/app$/);

    await page.goto("/app/profile");
    await page.getByRole("button", { name: "Delete my account" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete your account?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Delete my account" }).click();

    await expect(page).toHaveURL(/\/sign-in\?deleted=1$/);
    await expect(page.getByRole("status")).toContainText("Your account has been deleted");
    await page.goto("/app");
    await expect(page).toHaveURL(/\/sign-in/);

    // Nothing to sign in with any more, and no hint that there ever was.
    await signIn(page, email, "a-short-phrase");
    await expect(page.getByRole("alert").filter({ hasText: "That email and password do not match" })).toBeVisible();
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

test.describe("privacy policy and terms of use", () => {
  test("are open to anyone and linked from sign-in", async ({ page }) => {
    await page.goto("/sign-in");
    const legal = page.getByRole("navigation", { name: "Legal" });
    await legal.getByRole("link", { name: "Privacy policy" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "How you sign in" })).toBeVisible();

    await page.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: "Terms of use" }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole("heading", { level: 1, name: "Terms of use" })).toBeVisible();
  });

  test("support is open to anyone, linked from sign-in and gives the contact email", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: "Support" }).click();
    await expect(page).toHaveURL(/\/support$/);
    await expect(page.getByRole("heading", { level: 1, name: "Support" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Help signing in" })).toBeVisible();
    const contact = page.getByRole("region", { name: "Contact us" }).getByRole("link", { name: "volunteering@satisfyfoodrescue.org.nz" });
    await expect(contact).toHaveAttribute("href", "mailto:volunteering@satisfyfoodrescue.org.nz");

    await page.getByRole("link", { name: "Forgot your password?" }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await page.goBack();
    await page.getByRole("region", { name: "Updating or deleting your details" }).getByRole("link", { name: "privacy policy" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
  });

  test("are linked from a volunteer's profile", async ({ page }) => {
    await signInAs(page, "margaret");
    await page.goto("/app/profile");
    await page.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: "Privacy policy" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
  });
});
