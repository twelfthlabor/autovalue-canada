import { expect, test } from "@playwright/test";

test("fold-bars avoids the mobile 2+2+1 orphan and stays 5-col on wide screens", async ({ page }, testInfo) => {
  await page.goto("/market-lab");
  const bars = page.locator(".fold-bars");
  await expect(bars).toBeVisible();
  await expect(bars.locator("div")).toHaveCount(5);

  const columns = await bars.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length);
  if (testInfo.project.name === "mobile-chrome") {
    // Narrow fallback is 2-col with the last bar full-width (2+2+full), not 2+2+half.
    expect(columns).toBe(2);
    const lastSpan = await bars.locator("div:last-child").evaluate((el) => {
      const grid = getComputedStyle(el);
      return { colStart: grid.gridColumnStart, colEnd: grid.gridColumnEnd };
    });
    expect(`${lastSpan.colStart} / ${lastSpan.colEnd}`).toMatch(/1.*-1/);
    // The last bar actually spans the track: no empty half-cell beside it.
    const widths = await bars.evaluate((el) => ({
      grid: el.getBoundingClientRect().width,
      last: el.lastElementChild!.getBoundingClientRect().width,
    }));
    expect(Math.abs(widths.last - widths.grid)).toBeLessThanOrEqual(1);
  } else {
    expect(columns).toBe(5);
    // All five bars share one row (no orphan).
    const tops = await bars.locator("div").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
  }
});
