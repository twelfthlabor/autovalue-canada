import { expect, test, type Page } from "@playwright/test";

async function bbox(page: Page, selector: string) {
  return page.locator(selector).first().boundingBox();
}

function intersectArea(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return xOverlap * yOverlap;
}

test("inner .page-hero h1 stays visible and clear of .hero-card", async ({ page }) => {
  for (const path of ["/methodology", "/calculation", "/market-lab"]) {
    await page.goto(path);
    const h1 = page.locator(".page-hero h1").first();
    await expect(h1).toBeVisible();
    const h1Box = await h1.boundingBox();
    expect(h1Box).not.toBeNull();
    expect(h1Box!.width).toBeGreaterThan(0);
    expect(h1Box!.height).toBeGreaterThan(0);

    const card = page.locator(".page-hero aside.hero-card, .page-hero .hero-card").first();
    if ((await card.count()) > 0) {
      await expect(card).toBeVisible();
      const cardBox = await card.boundingBox();
      expect(cardBox).not.toBeNull();
      // In-flow aside must not cover the heading (scoped absolute leak guard).
      expect(intersectArea(h1Box!, cardBox!)).toBe(0);
      const position = await card.evaluate((el) => getComputedStyle(el).position);
      expect(position).not.toBe("absolute");
    }
  }
});

test("landing hero card stays scoped to .hero-visual", async ({ page }) => {
  await page.goto("/");
  const card = page.locator(".hero-visual .hero-card").first();
  await expect(card).toBeVisible();
  const cardBox = await card.boundingBox();
  expect(cardBox).not.toBeNull();
  expect(cardBox!.width).toBeGreaterThan(0);
  const visualBox = await bbox(page, ".hero-visual");
  expect(visualBox).not.toBeNull();
  // Card lives inside the landing visual container.
  expect(cardBox!.x).toBeGreaterThanOrEqual(visualBox!.x - 2);
  expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(visualBox!.x + visualBox!.width + 2);
  const position = await card.evaluate((el) => getComputedStyle(el).position);
  expect(position).toBe("absolute");
});

test("mobile header keeps nav + external inside without page overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".site-header")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  const header = await bbox(page, ".site-header");
  const nav = await bbox(page, ".site-header nav");
  const external = await bbox(page, ".nav-external");
  expect(header).not.toBeNull();
  expect(nav).not.toBeNull();
  expect(external).not.toBeNull();
  // Nav row sits inside the header (no y:-4 clip, no spill past the bottom).
  expect(nav!.y).toBeGreaterThanOrEqual(header!.y - 1);
  expect(nav!.y + nav!.height).toBeLessThanOrEqual(header!.y + header!.height + 1);
  expect(external!.x + external!.width).toBeLessThanOrEqual(header!.x + header!.width + 1);
  expect(external!.y).toBeGreaterThanOrEqual(header!.y - 1);
  expect(external!.y + external!.height).toBeLessThanOrEqual(header!.y + header!.height + 1);
});

test("band-close spreads median/ask labels when values are close", async ({ page }) => {
  await page.goto("/#check");
  const estimate = page.getByTestId("ml-estimate");
  await expect(estimate).toBeVisible();
  const dollars = (v: string | null) => Number((v ?? "").replace(/[^0-9]/g, ""));
  const target = dollars(await estimate.textContent());
  expect(target).toBeGreaterThan(0);

  async function labelOverlap() {
    // Let the 460ms spring settle before measuring label boxes.
    await page.waitForTimeout(700);
    const boxes = await page.evaluate(() => {
      const med = document.querySelector(".band-median i")?.getBoundingClientRect();
      const ask = document.querySelector(".band-asking i")?.getBoundingClientRect();
      return {
        med: med ? { x: med.x, y: med.y, width: med.width, height: med.height } : null,
        ask: ask ? { x: ask.x, y: ask.y, width: ask.width, height: ask.height } : null,
      };
    });
    expect(boxes.med).not.toBeNull();
    expect(boxes.ask).not.toBeNull();
    return intersectArea(boxes.med!, boxes.ask!);
  }

  // Default ask (31,995) sits within 8pp of the estimate: collision path on, labels clear.
  await expect(page.locator(".price-band.band-close")).toHaveCount(1);
  expect(await labelOverlap()).toBe(0);

  // A nearby ask stays in the collision path and stays legible.
  await page.getByLabel("Asking price in Canadian dollars").fill(String(target + 700));
  await expect(page.locator(".price-band.band-close")).toHaveCount(1);
  expect(await labelOverlap()).toBe(0);

  // A distant ask leaves the collision path (flag is conditional, not always-on).
  await page.getByLabel("Asking price in Canadian dollars").fill(String(target + 10000));
  await expect(page.locator(".price-band.band-close")).toHaveCount(0);
});

test("lab-stats keeps 5 columns on wide screens", async ({ page }, testInfo) => {
  await page.goto("/market-lab");
  const stats = page.locator(".lab-stats");
  await expect(stats).toBeVisible();
  await expect(stats.locator("article")).toHaveCount(5);
  const columns = await stats.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length);
  if (testInfo.project.name === "mobile-chrome") {
    // Narrow fallback stays 2-col with the last card full-width (2+2+full).
    expect(columns).toBe(2);
    const lastSpan = await stats.locator("article:last-child").evaluate((el) => {
      const grid = getComputedStyle(el);
      return { colStart: grid.gridColumnStart, colEnd: grid.gridColumnEnd };
    });
    expect(`${lastSpan.colStart} / ${lastSpan.colEnd}`).toMatch(/1.*-1/);
  } else {
    expect(columns).toBe(5);
    // All five cards share one row (no 4+1 orphan).
    const tops = await stats.locator("article").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
  }
});

test("JD Power theme tokens applied and ml-estimate present", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("ml-estimate")).toBeVisible();
  const vars = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      brand: cs.getPropertyValue("--brand").trim(),
      accent: cs.getPropertyValue("--accent").trim(),
      ink: cs.getPropertyValue("--ink").trim(),
      faint: cs.getPropertyValue("--faint").trim(),
    };
  });
  expect(vars.brand.toLowerCase()).toBe("#00838f");
  expect(vars.accent.toLowerCase()).toBe("#d34612");
  expect(vars.ink.toLowerCase()).toBe("#102330");
  expect(vars.faint.toLowerCase()).toBe("#5a6b76");
});
