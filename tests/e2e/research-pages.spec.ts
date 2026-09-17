import { expect, test } from "@playwright/test";
import market from "../../public/data/market.json";

test("province inspection and coverage measure use the released market cells", async ({ page }) => {
  await page.goto("/market-lab");
  await page.getByRole("button", { name: "Inspect Alberta", exact: true }).click();
  const rows = market.filter(row => row.p === "AB");
  const vehicles = rows.reduce((sum, row) => sum + row.n, 0);
  await expect(page.getByTestId("province-vehicles")).toHaveText(vehicles.toLocaleString("en-CA"));
  const province = page.getByRole("button", { name: "Inspect Alberta", exact: true });
  await expect(province).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Coverage measure").selectOption("cells");
  await expect(province).toContainText(rows.length.toLocaleString("en-CA"));
  await expect(page.getByTestId("province-vehicles")).toHaveText(vehicles.toLocaleString("en-CA"));
  await expect(province).toHaveAttribute("aria-pressed", "true");
});

test("the worked calculation responds to inputs and exposes each term", async ({ page }) => {
  await page.goto("/calculation");
  const estimate = page.getByTestId("example-estimate");
  const initial = await estimate.textContent();
  const dollars = (value: string | null) => Number(value?.replace(/[^\d]/g, ""));
  await page.getByRole("button", { name: "Rough", exact: true }).click();
  await expect(estimate).not.toHaveText(initial!);
  expect(dollars(await estimate.textContent())).toBeLessThan(dollars(initial));
  const rough = await estimate.textContent();
  await page.getByRole("button", { name: /^Canadian anchor/ }).click();
  await expect(page.getByRole("heading", { name: "The Canadian starting point" })).toBeVisible();
  await expect(estimate).toHaveText(rough!);
  const row = market.find(row => row.p === "ON" && row.mk === "Toyota" && row.md === "RAV4" && row.y === 2021)!;
  await expect(page.locator(".calculation-explanation")).toContainText(row.km.toLocaleString("en-CA"));
  await page.getByRole("slider", { name: "Example odometer" }).focus();
  await page.keyboard.press("End");
  expect(dollars(await estimate.textContent())).toBeLessThan(dollars(rough));
  await page.getByRole("button", { name: /Reset example/ }).click();
  await expect(estimate).toHaveText(initial!);
  await expect(page.getByRole("slider", { name: "Example odometer" })).toHaveValue("89000");
});

test("research pages remain within phone and tablet widths", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Explicit viewport coverage");
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const route of ["/market-lab", "/methodology", "/calculation"]) {
      await page.goto(route);
      await expect(page.locator(".report-header h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${route} at ${width}px`).toBeLessThanOrEqual(1);
    }
  }
});
