import { expect, test, type Page } from "@playwright/test";
import { PEOPLE, signInAs } from "./support/auth";
import { latestEmailTo } from "./support/db";

async function fillSignUp(page: Page, email: string) {
  await page.getByLabel("First name").fill("Tama");
  await page.getByLabel("Last name").fill("Rewi");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mobile", { exact: true }).fill("021 555 0199");
  await page.getByLabel("Suburb or town").fill("Woodend");
  // The checkboxes are drawn; their labels take the click.
  await page.getByText("Warehouse sorting", { exact: true }).click();
  await page.getByText("Harvest", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /Warehouse sorting/ })).toBeChecked();
  await page.getByLabel("Usual availability").fill("Thursday mornings");
  await page.getByLabel("Their name").fill("Mere Rewi");
  await page.getByLabel("Their phone").fill("027 555 0198");
  await page.getByText("and am happy for Satisfy").click();
  await expect(page.getByRole("checkbox", { name: /I have read the privacy policy/ })).toBeChecked();
}

test("someone signs up, then the coordinator approves them", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Sign up to volunteer" }).click();
  await expect(page.getByRole("heading", { name: "Sign up to volunteer" })).toBeVisible();

  // Nothing filled in: every field to fix is named, and the first has focus.
  await page.getByRole("button", { name: "Send my application" }).click();
  await expect(page.getByText("Enter your first name.")).toBeVisible();
  await expect(page.getByText("Choose at least one way you would like to help.")).toBeVisible();
  await expect(page.getByText("Please confirm you have read the privacy policy.")).toBeVisible();
  await expect(page.getByLabel("First name")).toBeFocused();

  await fillSignUp(page, "tama.rewi@example.nz");
  await page.getByRole("button", { name: "Send my application" }).click();
  await expect(page.getByRole("heading", { name: "Thanks, Tama" })).toBeVisible();
  await expect(page.getByText("We have emailed a confirmation to tama.rewi@example.nz.")).toBeVisible();
  expect(await latestEmailTo("tama.rewi@example.nz")).toMatchObject({ kind: "APPLICATION_RECEIVED" });

  await signInAs(page, "phillipa");
  await page.goto("/admin/applications");
  const card = page.locator("article").filter({ hasText: "Tama Rewi" });
  await expect(card.getByText("Website sign-up")).toBeVisible();
  await expect(card.getByText("Mere Rewi")).toBeVisible();
  await card.getByRole("button", { name: "Approve Tama" }).click();
  await expect(page.getByText("Tama approved. Account created")).toBeVisible();
  expect(await latestEmailTo("tama.rewi@example.nz", "ACCOUNT_INVITE")).toMatchObject({ kind: "ACCOUNT_INVITE" });
});

test("signing up with an address that has an account says nothing different", async ({ page }) => {
  await page.goto("/sign-up");
  await fillSignUp(page, PEOPLE.margaret);
  await page.getByRole("button", { name: "Send my application" }).click();
  await expect(page.getByRole("heading", { name: "Thanks, Tama" })).toBeVisible();
  expect(await latestEmailTo(PEOPLE.margaret, "ALREADY_REGISTERED")).toMatchObject({ kind: "ALREADY_REGISTERED" });
});
