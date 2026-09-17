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

test("research headings stay visible and clear of the release metadata", async ({ page }) => {
  for (const path of ["/methodology", "/calculation", "/market-lab"]) {
    await page.goto(path);
    const h1 = page.locator(".report-header h1").first();
    await expect(h1).toBeVisible();
    const h1Box = await h1.boundingBox();
    expect(h1Box).not.toBeNull();
    expect(h1Box!.width).toBeGreaterThan(0);
    expect(h1Box!.height).toBeGreaterThan(0);

    const card = page.locator(".report-header > span").first();
    if ((await card.count()) > 0) {
      await expect(card).toBeVisible();
      const cardBox = await card.boundingBox();
      expect(cardBox).not.toBeNull();
      // Release metadata stays in flow and never covers the title.
      expect(intersectArea(h1Box!, cardBox!)).toBe(0);
      const position = await card.evaluate((el) => getComputedStyle(el).position);
      expect(position).not.toBe("absolute");
    }
  }
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

test("band markers stay on the value scale when values are close", async ({ page }) => {
  await page.goto("/#check");
  const estimate = page.getByTestId("ml-estimate");
  await expect(estimate).toBeVisible();
  const dollars = (v: string | null) => Number((v ?? "").replace(/[^0-9]/g, ""));
  const target = dollars(await estimate.textContent());
  expect(target).toBeGreaterThan(0);

  // Disable the 460ms `left` spring + grow animations so measurements read the
  // settled geometry without a fixed sleep.
  await page.addStyleTag({
    content: "*, *::before, *::after { transition-duration: 0s !important; transition-delay: 0s !important; animation-duration: 0s !important; animation-delay: 0s !important; }",
  });
  await page.evaluate(async () => { await document.fonts.ready; });

  const measure = () =>
    page.evaluate(() => {
      const rect = (el: Element) => {
        const box = el.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height, centerX: box.x + box.width / 2 };
      };
      const declared = (el: HTMLElement) => {
        const data = el.getAttribute("data-band-pos");
        if (data !== null && data.trim() !== "") return Number(data);
        const left = el.style.left;
        return left && left.endsWith("%") ? parseFloat(left) : null;
      };
      const textNode = (root: Element | null) => {
        if (!root) return null;
        for (const node of Array.from(root.childNodes)) {
          if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "") return node;
        }
        return null;
      };
      const rangeRect = (node: Node | null) => {
        if (!node) return null;
        const range = document.createRange();
        range.selectNodeContents(node);
        const box = range.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      };
      const band = document.querySelector(".price-band");
      const card = document.querySelector(".valuation-band");
      if (!band || !card) return null;
      const medianDot = band.querySelector<HTMLElement>(".band-median");
      const askDot = band.querySelector<HTMLElement>(".band-asking");
      const medianLabel = medianDot?.querySelector("i") ?? null;
      const askLabel = askDot?.querySelector("i") ?? null;
      return {
        band: rect(band),
        card: rect(card),
        medianDot: medianDot ? rect(medianDot) : null,
        askDot: askDot ? rect(askDot) : null,
        medianLabel: medianLabel ? rect(medianLabel) : null,
        askLabel: askLabel ? rect(askLabel) : null,
        medianPos: medianDot ? declared(medianDot) : null,
        askPos: askDot ? declared(askDot) : null,
        medianText: rangeRect(textNode(medianLabel)),
        askTagText: rangeRect(textNode(askLabel?.querySelector("b") ?? null)),
      };
    });

  async function assertOnScale(stateLabel: string) {
    // Let the 460ms spring settle, then measure the rendered geometry.
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const snapshot = await measure();
    expect(snapshot, `${stateLabel}: band geometry`).not.toBeNull();
    if (!snapshot) return;

    for (const marker of [
      { name: "median", dot: snapshot.medianDot, label: snapshot.medianLabel, pos: snapshot.medianPos },
      { name: "ask", dot: snapshot.askDot, label: snapshot.askLabel, pos: snapshot.askPos },
    ]) {
      expect(marker.dot, `${stateLabel}: ${marker.name} dot present`).not.toBeNull();
      expect(marker.label, `${stateLabel}: ${marker.name} label present`).not.toBeNull();
      expect(marker.pos, `${stateLabel}: ${marker.name} declared position present`).not.toBeNull();
      if (!marker.dot || !marker.label || marker.pos === null) continue;

      const desired = snapshot.band.x + (snapshot.band.width * marker.pos) / 100;
      expect(Math.abs(marker.dot.centerX - desired), `${stateLabel}: ${marker.name} dot center is off its declared value position`).toBeLessThanOrEqual(1);

      const lower = snapshot.card.x + 1 + marker.label.width / 2;
      const upper = snapshot.card.x + snapshot.card.width - 1 - marker.label.width / 2;
      const expected = Math.min(Math.max(desired, lower), upper);
      expect(Math.abs(marker.label.centerX - expected), `${stateLabel}: ${marker.name} label center is off the clamped value scale`).toBeLessThanOrEqual(1);

      expect(marker.label.x, `${stateLabel}: ${marker.name} label clipped on the left`).toBeGreaterThanOrEqual(snapshot.card.x - 0.5);
      expect(marker.label.x + marker.label.width, `${stateLabel}: ${marker.name} label clipped on the right`).toBeLessThanOrEqual(snapshot.card.x + snapshot.card.width + 0.5);
    }

    expect(snapshot.medianText, `${stateLabel}: median value text`).not.toBeNull();
    expect(snapshot.askTagText, `${stateLabel}: ask label text`).not.toBeNull();
    if (snapshot.medianText && snapshot.askTagText) {
      const overlapX = Math.max(0, Math.min(snapshot.medianText.x + snapshot.medianText.width, snapshot.askTagText.x + snapshot.askTagText.width) - Math.max(snapshot.medianText.x, snapshot.askTagText.x));
      const overlapY = Math.max(0, Math.min(snapshot.medianText.y + snapshot.medianText.height, snapshot.askTagText.y + snapshot.askTagText.height) - Math.max(snapshot.medianText.y, snapshot.askTagText.y));
      expect(overlapX * overlapY, `${stateLabel}: median value and ask label text overlap`).toBeLessThan(0.5);
    }
  }

  // Default ask (31,995) sits within 14pp of the estimate: collision path on, still on scale.
  await expect(page.locator(".price-band.band-close")).toHaveCount(1);
  await assertOnScale("default close");

  // A nearby above-estimate ask stays in the collision path and stays legible.
  await page.getByLabel("Asking price in Canadian dollars").fill(String(target + 700));
  await expect(page.locator(".price-band.band-close")).toHaveCount(1);
  await expect(page.locator(".price-band.band-ask-left")).toHaveCount(0);
  await assertOnScale("close above");

  // Below-estimate asks (ask < median) must stay centered on their own dots,
  // not mirror into a side-by-side spread. Regression from bd5e383.
  for (const offset of [-2000, -500]) {
    await page.getByLabel("Asking price in Canadian dollars").fill(String(target + offset));
    await expect(page.locator(".price-band.band-close")).toHaveCount(1);
    await assertOnScale(`close below ${offset}`);
  }

  // Exact coincidence (ask == estimate, 0pp) keeps the exact path with zero text overlap.
  await page.getByLabel("Asking price in Canadian dollars").fill(String(target));
  await expect(page.locator(".price-band.band-close.band-exact")).toHaveCount(1);
  await assertOnScale("exact coincidence");

  // A distant ask leaves the collision path (flag is conditional, not always-on).
  await page.getByLabel("Asking price in Canadian dollars").fill(String(target + 10000));
  await expect(page.locator(".price-band.band-close")).toHaveCount(0);
  await assertOnScale("distant above");
});

test("lab-stats keeps 5 columns on wide screens", async ({ page }) => {
  await page.goto("/market-lab");
  const stats = page.locator(".lab-stats");
  await expect(stats).toBeVisible();
  await expect(stats.locator("article")).toHaveCount(5);
  const columns = await stats.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length);
  // Narrow fallback is selected by viewport width, so every mobile project gets it.
  if ((page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) <= 680) {
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
