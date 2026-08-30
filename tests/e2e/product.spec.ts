import { expect, test } from "@playwright/test";

test("default price check is complete and evidence-labelled", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/AutoValue Canada/);
  await expect(page.getByRole("heading", { name: /See the market behind/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "2021 Toyota RAV4" })).toBeVisible();
  await expect(page.getByText("$30,248")).toBeVisible();
  await expect(page.getByText(/204 vehicles/)).toBeVisible();
  await expect(page.getByText("Dealer asking prices are not completed transactions.")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true });
});

test("vehicle controls cascade to a supported market cell", async ({ page }) => {
  await page.goto("/#check");
  await expect(page.getByRole("heading", { name: "2021 Toyota RAV4" })).toBeVisible();
  await page.getByLabel("Model", { exact: true }).selectOption("Camry");
  await expect(page.getByRole("heading", { name: /Toyota Camry/ })).toBeVisible();
});

test("methodology and control-room evidence are public", async ({ page }) => {
  await page.goto("/methodology");
  await expect(page.getByRole("heading", { name: "Claim boundary" })).toBeVisible();
  await expect(page.getByText("BLOCKED", { exact: true }).first()).toBeVisible();

  await page.goto("/market-lab");
  await expect(page.getByRole("heading", { name: "All release gates passed" })).toBeVisible();
  await expect(page.getByText("VERIFIED")).toBeVisible();
  await expect(page.getByText("5,605")).toBeVisible();
  await expect(page.getByText("−45.2%")).toBeVisible();
  await expect(page.getByText(/Zero make-model overlap/)).toBeVisible();
});
