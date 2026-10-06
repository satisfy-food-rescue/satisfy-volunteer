import { expect, test } from "@playwright/test";
import { signInAs } from "./support/auth";

// The core rule: lapsed training blocks booking until it is refreshed.
test("an overdue refresher blocks route shifts until it is completed", async ({ page }) => {
  await signInAs(page, "tony");
  await page.goto("/app/gaps");

  const locked = page.getByText("Complete the Manual Handling refresher to book driver help shifts").first();
  await expect(locked).toBeVisible();
  await page.getByRole("link", { name: "Go to training" }).first().click();
  await expect(page).toHaveURL(/\/app\/training\/MANUAL_HANDLING$/);

  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirm and record completion" }).click();
  await expect(page.getByText("Manual Handling recorded.")).toBeVisible();

  await page.goto("/app/gaps");
  await expect(page.getByText("Complete the Manual Handling refresher")).toHaveCount(0);
  const cover = page.getByRole("button", { name: "I can cover this" }).first();
  await expect(cover).toBeVisible();
  await cover.click();
  await expect(page.getByText("Ka pai, you're covering this shift.")).toBeVisible();
});
