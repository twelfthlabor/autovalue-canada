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

    // Equal percentages must render at an equal pixel scale: the spanning last
    // bar's inner track has to stay one column wide, not two. Wait out the
    // 700ms band-grow animation before measuring.
    await page.waitForTimeout(900);
    const measured = await bars.evaluate((el) => {
      const cells = [...el.children];
      const tracks = cells.map((cell) => cell.querySelector("i")!.getBoundingClientRect().width);
      const fills = cells.map((cell) => cell.querySelector("i > b")!.getBoundingClientRect().width);
      return { tracks, fills };
    });
    console.log("FOLD_BAR_MEASUREMENTS", JSON.stringify(measured));
    await testInfo.attach("fold-bar-measurements.json", { body: JSON.stringify(measured), contentType: "application/json" });

    expect(Math.max(...measured.tracks) - Math.min(...measured.tracks)).toBeLessThanOrEqual(1);
    expect(Math.abs(measured.fills[3] - measured.fills[4])).toBeLessThanOrEqual(2);
  } else {
    expect(columns).toBe(5);
    // All five bars share one row (no orphan).
    const tops = await bars.locator("div").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
  }
});
