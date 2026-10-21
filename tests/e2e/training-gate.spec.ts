import { expect, test } from "@playwright/test";
import { signInAs } from "./support/auth";

// The core rule: lapsed training blocks booking until it is refreshed.
test("an overdue refresher blocks route shifts until it is completed", async ({ page, context }) => {
  // The module's video opens on YouTube in a new tab; keep the test offline.
  await context.route(/youtube\.com/, (route) => route.fulfill({ status: 200, body: "video" }));
  await signInAs(page, "tony");
  await page.goto("/app/gaps");

  // Every gap is locked to Tony, so the Cover tab has no badge to nag him.
  const coverTab = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /^Cover/ });
  await expect(coverTab).toHaveAccessibleName("Cover");
  const locked = page.getByText("Complete the Manual Handling refresher to book driver help shifts").first();
  await expect(locked).toBeVisible();
  await page.getByRole("link", { name: "Go to my training" }).click();
  await expect(page).toHaveURL(/\/app\/training\/MANUAL_HANDLING$/);

  // Confirmation unlocks once the content is read to the end and the video opened.
  const confirm = page.getByRole("checkbox");
  await expect(confirm).toBeDisabled();
  await page.getByRole("list", { name: "Before you confirm" }).scrollIntoViewIfNeeded();
  const video = context.waitForEvent("page");
  await page.getByRole("link", { name: /Manual handling: how to lift safely/ }).click();
  await (await video).close();
  await confirm.check();
  await page.getByRole("button", { name: "Record completion" }).click();
  await expect(page.getByText("Manual Handling recorded.")).toBeVisible();

  await page.goto("/app/gaps");
  await expect(page.getByText("Complete the Manual Handling refresher")).toHaveCount(0);
  await expect(coverTab).toHaveAccessibleName(/^Cover ?, \d+ shifts? you can cover$/);
  const cover = page.getByRole("button", { name: "I can cover this" }).first();
  await expect(cover).toBeVisible();
  await cover.click();
  await expect(page.getByText("Ka pai, you're covering this shift.")).toBeVisible();
});
