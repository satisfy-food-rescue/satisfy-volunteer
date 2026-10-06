import { expect, type Page } from "@playwright/test";

// Demo-data accounts. The seed gives the four personas DEMO_PASSWORD
// (src/lib/demo/personas.ts); these are fixtures, never real accounts.
export const PASSWORD = "kai-rescue-demo";
export const PEOPLE = {
  phillipa: "phillipa@satisfyfoodrescue.org.nz",
  margaret: "margaret.fairweather@example.nz",
  tony: "tony.ratana@example.nz",
  jess: "jess.moorhouse@example.nz",
} as const;

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

export async function signInAs(page: Page, who: keyof typeof PEOPLE) {
  await page.goto("/sign-in");
  await signIn(page, PEOPLE[who]);
  await expect(page).toHaveURL(who === "phillipa" ? /\/admin$/ : /\/app$/);
}
