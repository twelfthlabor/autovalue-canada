import { expect, test, type Page } from "@playwright/test";

/**
 * Connector settle regression (a transition is injected to stress layout).
 *
 * The band connector geometry is written from a layout effect. If that pass
 * reads the sibling dot's live `left` rect while its 460ms spring is mid-flight
 * (a re-measure lands during a cascade of selects/fills), the sibling-avoidance
 * branch fires on a transient overlap and writes the short merged-disc length
 * (7.5px / 7.97px). Nothing re-measures after the spring settles, so the short
 * link survives.
 *
 * This spec freezes the ask dot's real CSSTransition over the median disc via
 * the Web Animations API, forces a re-measure with a $1 ask edit, then releases
 * the spring and asserts the settled connector lengths. It is deterministic
 * (no timing lottery) and fails on the live-rect implementation.
 */

const SETTLE_MS = 800;

async function primeAskAtLeftEdge(page: Page) {
  await page.getByLabel("Asking price in Canadian dollars").fill("20000");
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function freezeAskDotOverMedian(page: Page) {
  return page.evaluate(async () => {
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Asking price in Canadian dollars"]');
    if (!input) return null;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, "31995");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const dot = document.querySelector<HTMLElement>(".band-asking");
    const median = document.querySelector<HTMLElement>(".band-median");
    if (!dot || !median) return null;
    let animation: Animation | undefined;
    for (let attempt = 0; attempt < 12 && !animation; attempt += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      animation = dot.getAnimations().find((candidate) => (candidate as CSSTransition).transitionProperty === "left");
    }
    if (!animation) return null;
    animation.pause();
    const band = document.querySelector<HTMLElement>(".price-band");
    const border = Number.parseFloat(getComputedStyle(band ?? dot).getPropertyValue("--band-dot-border")) || 3;
    const medianRect = median.getBoundingClientRect();
    const medianCenter = medianRect.x + medianRect.width / 2;
    const visibleRadius = dot.getBoundingClientRect().width / 2 - border;
    const duration = Number(animation.effect?.getTiming().duration ?? 460);
    const centerAt = (t: number) => {
      animation!.currentTime = t;
      const rect = dot.getBoundingClientRect();
      return rect.x + rect.width / 2;
    };
    // Bracket the disc crossing, then refine to the instant the transient ask
    // centre sits on the median centre (the deepest-overlap re-measure).
    let lo: number | null = null;
    let hi: number | null = null;
    for (let t = 0; t <= duration; t += 2) {
      if (centerAt(t) - medianCenter <= 0) lo = t;
      else { hi = t; break; }
    }
    if (lo === null || hi === null) {
      animation.play();
      return null;
    }
    let frozenAt = lo;
    let best = Math.abs(centerAt(lo) - medianCenter);
    for (let t = lo; t <= hi; t += 0.1) {
      const distance = Math.abs(centerAt(t) - medianCenter);
      if (distance < best) { best = distance; frozenAt = t; }
    }
    animation.currentTime = frozenAt;
    const frozen = dot.getBoundingClientRect();
    return { frozenAt, dx: frozen.x + frozen.width / 2 - medianCenter, visibleRadius, deepest: best };
  });
}

async function remeasureWhileFrozen(page: Page) {
  return page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Asking price in Canadian dollars"]');
    if (!input) return null;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, "31996");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const dot = document.querySelector<HTMLElement>(".band-asking");
    const median = document.querySelector<HTMLElement>(".band-median");
    const medianLink = document.querySelector<HTMLElement>(".band-median .band-link");
    if (!dot || !median || !medianLink) return null;
    const dotRect = dot.getBoundingClientRect();
    const medianRect = median.getBoundingClientRect();
    const band = document.querySelector<HTMLElement>(".price-band");
    const border = Number.parseFloat(getComputedStyle(band ?? dot).getPropertyValue("--band-dot-border")) || 3;
    return {
      dx: dotRect.x + dotRect.width / 2 - (medianRect.x + medianRect.width / 2),
      visibleRadius: dotRect.width / 2 - border,
      medianLengthAtWrite: getComputedStyle(medianLink).getPropertyValue("--band-link-length").trim(),
    };
  });
}

async function settledLinks(page: Page) {
  return page.evaluate(() => {
    const read = (selector: string) => {
      const link = document.querySelector<HTMLElement>(selector);
      if (!link) return null;
      const style = getComputedStyle(link);
      const rect = link.getBoundingClientRect();
      return { length: Number.parseFloat(style.getPropertyValue("--band-link-length")) || 0, rendered: Math.max(rect.width, rect.height) };
    };
    return { median: read(".band-median .band-link"), ask: read(".band-asking .band-link") };
  });
}

for (const project of [
  { name: "chromium-desktop", viewport: { width: 1280, height: 720 } },
  { name: "mobile-chrome", viewport: { width: 390, height: 844 } },
] as const) {
  test(`connector settles after a mid-spring re-measure @${project.viewport.width}x${project.viewport.height}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== project.name, "runs once per viewport from its own project");
    test.setTimeout(120_000);
    await page.setViewportSize(project.viewport);
    await page.goto("/#check");
    await expect(page.getByTestId("ml-estimate")).toBeVisible();
    await page.evaluate(async () => { await document.fonts.ready; });

    // Production input is immediate. Retain the historical geometry regression
    // by deliberately injecting the old movement before forcing a re-measure.
    await page.addStyleTag({ content: ".result-panel .band-median, .result-panel .band-asking { transition: left 460ms cubic-bezier(.3,1.3,.45,1) !important; }" });

    // Park the ask at the left edge so the next change runs the full spring
    // across the median dot.
    await primeAskAtLeftEdge(page);

    // Freeze the real spring exactly while the transient ask disc overlaps the
    // median disc, then force the connector pass to re-measure.
    const frozen = await freezeAskDotOverMedian(page);
    expect(frozen, "ask-dot spring frozen over the median disc").not.toBeNull();
    if (!frozen) return;
    expect(Math.abs(frozen.dx), "frozen ask disc overlaps the median disc").toBeLessThanOrEqual(frozen.visibleRadius);

    const mid = await remeasureWhileFrozen(page);
    expect(mid, "re-measure while frozen").not.toBeNull();
    if (!mid) return;
    expect(Math.abs(mid.dx), "re-measure happens while the discs overlap").toBeLessThanOrEqual(mid.visibleRadius);

    // Release the spring, let it settle, then the settled contract must hold.
    await page.waitForTimeout(SETTLE_MS);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const settled = await settledLinks(page);
    expect(settled.median, "median connector").not.toBeNull();
    expect(settled.ask, "ask connector").not.toBeNull();
    if (!settled.median || !settled.ask) return;
    expect(settled.median.length, "settled median connector length").toBeGreaterThanOrEqual(8);
    expect(settled.ask.length, "settled ask connector length").toBeGreaterThanOrEqual(8);
    // The rendered bar must actually be that long (no stale CSS var).
    expect(settled.median.rendered, "settled median connector rendered size").toBeGreaterThanOrEqual(8);
    expect(settled.ask.rendered, "settled ask connector rendered size").toBeGreaterThanOrEqual(8);
  });
}
