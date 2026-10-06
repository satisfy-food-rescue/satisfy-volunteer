import { expect, test } from "@playwright/test";
import { signInAs } from "./support/auth";
import { latestEmailTo } from "./support/db";

test("a coordinator adds a volunteer, who gets an invite, then deactivates them", async ({ page }) => {
  await signInAs(page, "phillipa");
  await page.goto("/admin/volunteers");
  await page.getByRole("button", { name: "Add volunteer" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("First name").fill("Hemi");
  await dialog.getByLabel("Last name").fill("Walker");
  await dialog.getByLabel("Email", { exact: true }).fill("Hemi.Walker@Example.NZ");
  await dialog.getByRole("button", { name: "Add volunteer" }).click();

  await expect(page.getByRole("heading", { name: "Hemi Walker", level: 1 })).toBeVisible();
  const account = page.getByRole("region", { name: "Account" });
  await expect(account).toContainText("Not yet");
  await expect(account).toContainText("Nothing set up yet");
  // Stored lower-cased; the invite went out (logged, in the test setup).
  await expect.poll(() => latestEmailTo("hemi.walker@example.nz")).toMatchObject({ kind: "ACCOUNT_INVITE", status: "SENT" });

  await account.getByRole("button", { name: "Deactivate" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Deactivate" }).click();
  await expect(account).toContainText("Inactive: cannot sign in");
  await expect(account.getByRole("button", { name: "Reactivate Hemi" })).toBeVisible();
});

test("a duplicate email is refused", async ({ page }) => {
  await signInAs(page, "phillipa");
  await page.goto("/admin/volunteers");
  await page.getByRole("button", { name: "Add volunteer" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("First name").fill("Margaret");
  await dialog.getByLabel("Email", { exact: true }).fill("margaret.fairweather@example.nz");
  await dialog.getByRole("button", { name: "Add volunteer" }).click();
  await expect(page.getByText("Someone with that email is already on the system.")).toBeVisible();
});

test("the outbox shows delivery status", async ({ page }) => {
  await signInAs(page, "phillipa");
  await page.goto("/admin/outbox");
  await expect(page.getByRole("heading", { name: "Every email the system has sent" })).toBeVisible();
});
