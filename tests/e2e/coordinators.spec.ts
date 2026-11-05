import { expect, test } from "@playwright/test";
import { signInAs } from "./support/auth";
import { issueSignInLink, latestEmailTo } from "./support/db";

test("a coordinator adds another, who sets up their account, then removes their access", async ({ page, browser }) => {
  await signInAs(page, "phillipa");
  await page.getByRole("link", { name: "Coordinators" }).click();
  await expect(page.getByRole("heading", { name: "Coordinators", level: 1 })).toBeVisible();
  const list = page.getByRole("list", { name: "Coordinators" });
  // Nobody removes their own access.
  await expect(list.getByRole("listitem", { name: "Phillipa" })).toContainText("You");
  await expect(list.getByRole("button", { name: /Remove access/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Add coordinator" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("First name").fill("Hana");
  await dialog.getByLabel("Last name").fill("Tau");
  await dialog.getByLabel("Email").fill("Hana.Tau@Example.NZ");
  await dialog.getByRole("button", { name: "Add coordinator" }).click();
  const hana = list.getByRole("listitem", { name: "Hana Tau" });
  await expect(hana).toContainText("hana.tau@example.nz");
  await expect(hana).toContainText("not signed in yet");
  await expect.poll(() => latestEmailTo("hana.tau@example.nz", "ACCOUNT_INVITE")).toMatchObject({ subject: "Set up your Satisfy coordinator account", status: "SENT" });

  // Hana sets a password from the invite and lands in the admin.
  const hanaContext = await browser.newContext();
  const hanaPage = await hanaContext.newPage();
  await hanaPage.goto(await issueSignInLink("hana.tau@example.nz", "INVITE"));
  await hanaPage.getByLabel("New password").fill("a-short-phrase");
  await hanaPage.getByLabel("Type it again").fill("a-short-phrase");
  await hanaPage.getByRole("button", { name: "Set password and sign in" }).click();
  await expect(hanaPage).toHaveURL(/\/admin$/);

  await page.reload();
  await expect(hana).toContainText("Last signed in");
  await hana.getByRole("button", { name: "Remove access for Hana Tau" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove access" }).click();
  await expect(page.getByText("Hana Tau is no longer a coordinator")).toBeVisible();
  await expect(hana).toHaveCount(0);
  await expect.poll(() => latestEmailTo("hana.tau@example.nz", "ADMIN_ACCESS")).toMatchObject({ subject: "Your Satisfy coordinator access has been removed" });

  // Hana stays signed in, as a volunteer.
  await hanaPage.goto("/admin");
  await expect(hanaPage).toHaveURL(/\/app$/);
  await hanaContext.close();
});

test("a rostered volunteer made a coordinator keeps volunteering until taken out of the lists", async ({ page }) => {
  await signInAs(page, "phillipa");
  await page.goto("/admin/coordinators");
  await page.getByRole("button", { name: "Add coordinator" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("First name").fill("Graham");
  await dialog.getByLabel("Email").fill("graham.lister@example.nz");
  await dialog.getByRole("button", { name: "Add coordinator" }).click();
  await expect(page.getByText("Graham Lister is now a coordinator and stays in the volunteer lists")).toBeVisible();
  const graham = page.getByRole("list", { name: "Coordinators" }).getByRole("listitem", { name: "Graham Lister" });
  await expect(graham.getByRole("switch", { name: "Also volunteers" })).toBeChecked();
  // Graham has never signed in, so the email is an invite worded for a coordinator.
  await expect.poll(() => latestEmailTo("graham.lister@example.nz", "ACCOUNT_INVITE")).toMatchObject({ subject: "Set up your Satisfy coordinator account", status: "SENT" });

  // Still a volunteer, marked as a coordinator.
  await page.goto("/admin/volunteers?q=graham");
  await expect(page.getByRole("link", { name: /Graham Lister/ })).toContainText("Coordinator");

  // Taking him out of the lists asks first, since he has a regular slot.
  await page.goto("/admin/coordinators");
  await graham.getByRole("switch", { name: "Also volunteers" }).click();
  const confirm = page.getByRole("dialog");
  await expect(confirm.getByRole("heading", { name: "Take Graham out of the volunteer lists?" })).toBeVisible();
  await expect(confirm).toContainText("Graham Lister has 1 regular slot and");
  await confirm.getByRole("button", { name: "Take off the roster" }).click();
  await expect(page.getByText("Graham Lister is no longer in the volunteer lists")).toBeVisible();
  await page.goto("/admin/volunteers?q=graham");
  await expect(page.getByText("No volunteers match these filters.")).toBeVisible();

  // Removing access makes him a volunteer again, with the changes in the history.
  await page.goto("/admin/coordinators");
  await graham.getByRole("button", { name: "Remove access for Graham Lister" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove access" }).click();
  // The list is hidden from assistive tech while the dialog is open, so wait for the result first.
  await expect(page.getByText("Graham Lister is no longer a coordinator")).toBeVisible();
  await expect(graham).toHaveCount(0);
  await page.goto("/admin/volunteers?q=graham");
  await page.getByRole("link", { name: /Graham Lister/ }).click();
  await expect(page.getByRole("heading", { name: "Graham Lister", level: 1 })).toBeVisible();
  await expect(page.getByText("Coordinator access removed by Phillipa.")).toBeVisible();
  await expect(page.getByText(/Taken out of the volunteer lists by Phillipa\. Removed from 1 regular slot and \d+ upcoming shifts?\./)).toBeVisible();
});
