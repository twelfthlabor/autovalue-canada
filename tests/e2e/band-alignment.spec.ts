import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

/**
 * Band alignment regression spec.
 *
 * Oracle: the declared value position (`data-band-pos`, or the legacy inline
 * `left` percentage on the dots pre-fix) is the single source of truth. Every
 * dot, label and caption center must sit at `bandBox.x + bandBox.width * pos /
 * 100`, clamped only by the measured minimal containment shift
 * `clamp(desired, card.left + 1 + width / 2, card.right - 1 - width / 2)`.
 *
 * The value -> percent mapping itself is pinned in `lib/band-layout.test.ts`
 * (repro values 8.33 / 17.07 / 34.56 / 51.46 / 91.67), so this spec is not
 * tautological: it checks the rendered geometry against the declared scale.
 *
 * Non-tautology on top of that: ABSOLUTE_PINS below pins static expected
 * percentages for two known rows (RAV4 2021 ON, Accent 2008 ON) against BOTH
 * the declared `data-band-pos` values and the rendered centers, so a mutation
 * of the value -> percent mapping (which would rewrite both `data-band-pos` and
 * the rendered geometry consistently) still fails this spec.
 *
 * Collision oracle: every pair of text boxes (median label, ask label, all
 * captions) must intersect by < 0.5px² at every state, not just the text-node
 * ranges. Boundary states cover the close threshold (<14pp) plus/minus 1pp, a
 * 15pp step above and below the median, and the narrow-width blind window
 * (RAV4 28,500 = 14.57pp and ask 34,947 = 23.00pp), with explicit 320x568
 * coverage for the narrowest supported tier.
 */

const DESKTOP_PROJECT = "chromium-desktop";
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 412, height: 915 };
const NARROW_VIEWPORT = { width: 320, height: 568 };

type BandFields = {
  province: string;
  make: string;
  model: string;
  year: string;
  odometer: string;
  ask: string;
};

type BandState = {
  slug: string;
  label: string;
  fields: BandFields;
  close: boolean;
  exact: boolean;
  edge?: "left" | "right";
  minCaptionRows?: number;
  /** Expected |askPos - medianPos| in percentage points (boundary states). */
  gapPp?: number;
  /** Also run this state at 320x568 from the mobile project. */
  narrow?: boolean;
};

const RAV4: Omit<BandFields, "ask"> = { province: "ON", make: "Toyota", model: "RAV4", year: "2021", odometer: "89000" };
const ACCENT: Omit<BandFields, "ask"> = { province: "ON", make: "Hyundai", model: "Accent", year: "2008", odometer: "150000" };

// RAV4 2021 ON value scale: { min: 25070, max: 42230, p50: 31000 } — pinned in
// lib/band-layout.test.ts. One percentage point = $171.60, so the boundary
// asks below are median +/- k * $171.60.
//   median + 13pp = $33,231   median - 13pp = $28,769   (just inside <14pp)
//   median + 15pp = $33,574   median - 15pp = $28,426   (just outside)
//   median + 23pp = $34,947   (far edge of the narrow-width blind window)

const STATES: BandState[] = [
  { slug: "close-above", label: "repro: ask 31,995 sits 5.80pp above the median", fields: { ...RAV4, ask: "31995" }, close: true, exact: false },
  { slug: "exact", label: "ask equals the median", fields: { ...RAV4, ask: "31000" }, close: true, exact: true },
  { slug: "close-below", label: "ask 30,500 sits below the median", fields: { ...RAV4, ask: "30500" }, close: true, exact: false },
  { slug: "far-above", label: "ask 39,000 far above the median", fields: { ...RAV4, ask: "39000" }, close: false, exact: false },
  { slug: "far-below", label: "ask 26,500 far below the median", fields: { ...RAV4, ask: "26500" }, close: false, exact: false },
  { slug: "edge-left", label: "ask 20,000 clamps to the 2.5% left edge", fields: { ...RAV4, ask: "20000" }, close: false, exact: false, edge: "left" },
  { slug: "edge-right", label: "ask 45,000 clamps to the 97.5% right edge", fields: { ...RAV4, ask: "45000" }, close: false, exact: false, edge: "right" },
  { slug: "accent-close-wrap", label: "low-price Accent wraps the P10/P25 captions", fields: { ...ACCENT, ask: "4400" }, close: true, exact: false, minCaptionRows: 2 },
  { slug: "accent-two-rows", label: "ask 5,200 keeps two caption rows without .band-close", fields: { ...ACCENT, ask: "5200" }, close: false, exact: false, minCaptionRows: 2, narrow: true },
  // Boundary sweep around the <14pp close threshold and the 15pp median step.
  { slug: "gap-13-above", label: "boundary: ask 33,231 = median + 13.00pp, just inside the <14pp close threshold", fields: { ...RAV4, ask: "33231" }, close: true, exact: false, gapPp: 13.0035, narrow: true },
  { slug: "gap-15-above", label: "boundary: ask 33,574 = median + 15.00pp, just outside the <14pp close threshold", fields: { ...RAV4, ask: "33574" }, close: false, exact: false, gapPp: 15.0, narrow: true },
  { slug: "gap-13-below", label: "boundary: ask 28,769 = median - 13.00pp, just inside the <14pp close threshold", fields: { ...RAV4, ask: "28769" }, close: true, exact: false, gapPp: 13.0035, narrow: true },
  { slug: "gap-15-below", label: "boundary: ask 28,426 = median - 15.00pp, just outside the <14pp close threshold", fields: { ...RAV4, ask: "28426" }, close: false, exact: false, gapPp: 15.0, narrow: true },
  // Critic reproductions from the ensemble: RAV4 28,500 (14.57pp, mobile 412)
  // and the far edge of the narrow-width blind window.
  { slug: "critic-rav4-28500", label: "critic repro: ask 28,500 sits 14.57pp below the median", fields: { ...RAV4, ask: "28500" }, close: false, exact: false, gapPp: 14.5688, narrow: true },
  { slug: "blind-23-above", label: "blind-window edge: ask 34,947 = median + 23.00pp", fields: { ...RAV4, ask: "34947" }, close: false, exact: false, gapPp: 23.0023, narrow: true },
];

/**
 * Static expected value-scale percentages for two known rows, from the pinned
 * scale in `lib/band-layout.test.ts`:
 *   RAV4 2021 ON  -> 8.33 / 17.07 / 34.56 / 51.46 / 91.67, ask 31,995 -> 40.36
 *   Accent 2008 ON -> 19.51 / 24.39 / 34.15 / 65.85 / 80.49
 * Checked against both `data-band-pos` and the rendered (clamped) centers.
 */
const ABSOLUTE_PINS: Record<string, Record<string, number>> = {
  "close-above": {
    "median-dot": 34.56,
    "median-label": 34.56,
    "ask-dot": 40.36,
    "ask-label": 40.36,
    "caption-0": 8.33,
    "caption-1": 17.07,
    "caption-2": 34.56,
    "caption-3": 51.46,
    "caption-4": 91.67,
  },
  "accent-two-rows": {
    "median-dot": 34.15,
    "median-label": 34.15,
    "caption-0": 19.51,
    "caption-1": 24.39,
    "caption-2": 34.15,
    "caption-3": 65.85,
    "caption-4": 80.49,
  },
};

type SnapshotRect = { x: number; y: number; width: number; height: number; centerX: number; centerY: number };

type SnapshotElement = {
  name: string;
  role: "dot" | "label" | "caption";
  oracle: string | null;
  declaredPos: number | null;
  dotCenterX: number | null;
  rect: SnapshotRect;
};

type BandSnapshot = {
  band: SnapshotRect;
  card: SnapshotRect;
  elements: SnapshotElement[];
  medianText: SnapshotRect | null;
  askTagText: SnapshotRect | null;
};

type MeasurementRow = {
  state: string;
  element: string;
  oracle: string | null;
  expectedPx: number | null;
  measuredPx: number;
  deltaPx: number | null;
  note: string;
};

const round = (value: number) => Math.round(value * 100) / 100;

function clampCenter(desiredCenter: number, width: number, card: SnapshotRect) {
  const lower = card.x + 1 + width / 2;
  const upper = card.x + card.width - 1 - width / 2;
  return Math.min(Math.max(desiredCenter, lower), upper);
}

function intersectionArea(a: SnapshotRect, b: SnapshotRect) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function containmentOverflow(rect: SnapshotRect, card: SnapshotRect) {
  return Math.max(
    card.x - rect.x,
    card.y - rect.y,
    rect.x + rect.width - (card.x + card.width),
    rect.y + rect.height - (card.y + card.height),
  );
}

async function settle(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function killAnimations(page: Page) {
  await page.addStyleTag({
    content: "*, *::before, *::after { transition-duration: 0s !important; transition-delay: 0s !important; animation-duration: 0s !important; animation-delay: 0s !important; }",
  });
  await page.evaluate(async () => { await document.fonts.ready; });
}

async function waitForMeasuredLayout(page: Page) {
  // The fix writes --band-shift from useLayoutEffect. Pre-fix this never
  // appears, so the wait is bounded and the measurement continues to RED.
  await page
    .waitForFunction(() => {
      const label = document.querySelector(".band-median i");
      if (!label) return false;
      return getComputedStyle(label).getPropertyValue("--band-shift").trim() !== "";
    }, undefined, { timeout: 1500 })
    .catch(() => undefined);
  await settle(page);
}

async function applyState(page: Page, state: BandState) {
  await page.goto("/#check");
  await expect(page.getByTestId("ml-estimate")).toBeVisible();
  await killAnimations(page);
  await page.getByLabel("Province").selectOption(state.fields.province);
  await page.getByLabel("Make").selectOption(state.fields.make);
  await page.getByLabel("Model", { exact: true }).selectOption(state.fields.model);
  await page.getByLabel("Model year").selectOption(state.fields.year);
  await page.getByLabel("Odometer in kilometres").fill(state.fields.odometer);
  await page.getByLabel("Asking price in Canadian dollars").fill(state.fields.ask);
  await expect(page.getByRole("heading", { name: `${state.fields.year} ${state.fields.make} ${state.fields.model}` })).toBeVisible();
  await settle(page);
  await waitForMeasuredLayout(page);
}

async function snapshotBand(page: Page) {
  return page.evaluate((): BandSnapshot | null => {
    const toRect = (el: Element): SnapshotRect => {
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, centerX: rect.x + rect.width / 2, centerY: rect.y + rect.height / 2 };
    };
    const declared = (el: HTMLElement): { pos: number | null; oracle: string | null } => {
      const data = el.getAttribute("data-band-pos");
      if (data !== null && data.trim() !== "") return { pos: Number(data), oracle: "data-band-pos" };
      const left = el.style.left;
      if (left && left.endsWith("%")) return { pos: parseFloat(left), oracle: "inline-left" };
      return { pos: null, oracle: null };
    };
    const textNodeOf = (root: Element | null): Node | null => {
      if (!root) return null;
      for (const node of Array.from(root.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "") return node;
      }
      return null;
    };
    const rangeRect = (node: Node | null): SnapshotRect | null => {
      if (!node) return null;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, centerX: rect.x + rect.width / 2, centerY: rect.y + rect.height / 2 };
    };

    const band = document.querySelector(".price-band");
    const card = document.querySelector(".valuation-band");
    if (!band || !card) return null;

    const elements: SnapshotElement[] = [];
    const medianDot = band.querySelector<HTMLElement>(".band-median");
    const askDot = band.querySelector<HTMLElement>(".band-asking");
    const medianInfo = medianDot ? declared(medianDot) : { pos: null, oracle: null };
    const askInfo = askDot ? declared(askDot) : { pos: null, oracle: null };
    const medianDotRect = medianDot ? toRect(medianDot) : null;
    const askDotRect = askDot ? toRect(askDot) : null;

    if (medianDotRect) elements.push({ name: "median-dot", role: "dot", oracle: medianInfo.oracle, declaredPos: medianInfo.pos, dotCenterX: null, rect: medianDotRect });
    if (askDotRect) elements.push({ name: "ask-dot", role: "dot", oracle: askInfo.oracle, declaredPos: askInfo.pos, dotCenterX: null, rect: askDotRect });

    const medianLabel = medianDot?.querySelector<HTMLElement>("i") ?? null;
    const askLabel = askDot?.querySelector<HTMLElement>("i") ?? null;
    if (medianLabel) {
      elements.push({ name: "median-label", role: "label", oracle: medianInfo.oracle, declaredPos: medianInfo.pos, dotCenterX: medianDotRect?.centerX ?? null, rect: toRect(medianLabel) });
    }
    if (askLabel) {
      elements.push({ name: "ask-label", role: "label", oracle: askInfo.oracle, declaredPos: askInfo.pos, dotCenterX: askDotRect?.centerX ?? null, rect: toRect(askLabel) });
    }

    const captions = Array.from(document.querySelectorAll<HTMLElement>(".band-caption span"));
    captions.forEach((caption, index) => {
      const info = declared(caption);
      elements.push({ name: `caption-${index}`, role: "caption", oracle: info.oracle, declaredPos: info.pos, dotCenterX: null, rect: toRect(caption) });
    });

    const askTagNode = askLabel ? textNodeOf(askLabel.querySelector("b")) : null;
    return {
      band: toRect(band),
      card: toRect(card),
      elements,
      medianText: medianLabel ? rangeRect(textNodeOf(medianLabel)) : null,
      askTagText: rangeRect(askTagNode),
    };
  });
}

async function runBandState(page: Page, testInfo: TestInfo, state: BandState, viewport: { width: number; height: number }) {
  test.setTimeout(180_000);
  const tag = `${state.slug}@${viewport.width}x${viewport.height}`;

  await applyState(page, state);
  await expect(page.locator(".price-band.band-close"), `${tag}: .band-close presence`).toHaveCount(state.close ? 1 : 0);
  await expect(page.locator(".price-band.band-exact"), `${tag}: .band-exact presence`).toHaveCount(state.exact ? 1 : 0);

  const snapshot = await snapshotBand(page);
  expect(snapshot, `${tag}: band snapshot`).not.toBeNull();
  if (!snapshot) return;

  // Screenshots first so a RED run still shows the displaced layout.
  await page.locator(".valuation-band").screenshot({ path: testInfo.outputPath(`band-${state.slug}-${viewport.width}.png`) });
  await page.screenshot({ path: testInfo.outputPath(`band-full-${state.slug}-${viewport.width}.png`), fullPage: true });

  const problems: string[] = [];
  const rows: MeasurementRow[] = [];
  const softCheck = (ok: boolean, message: string) => {
    expect.soft(ok, message).toBe(true);
    if (!ok) problems.push(message);
  };

  for (const element of snapshot.elements) {
    const measured = element.rect.centerX;
    if (element.declaredPos === null) {
      const message = element.role === "caption"
        ? `${tag} ${element.name}: not on value scale (no data-band-pos or inline left)`
        : `${tag} ${element.name}: no declared value position (no data-band-pos or inline left)`;
      softCheck(false, message);
      rows.push({ state: tag, element: element.name, oracle: null, expectedPx: null, measuredPx: round(measured), deltaPx: null, note: "not on value scale" });
      continue;
    }

    const desired = snapshot.band.x + (snapshot.band.width * element.declaredPos) / 100;
    const expected = clampCenter(desired, element.rect.width, snapshot.card);
    const delta = measured - expected;
    const clamped = Math.abs(expected - desired) > 0.01;

    rows.push({
      state: tag,
      element: element.name,
      oracle: element.oracle,
      expectedPx: round(expected),
      measuredPx: round(measured),
      deltaPx: round(delta),
      note: clamped ? "clamped" : "centered",
    });
    console.log(
      `[band-alignment] ${tag} ${element.name} pos=${element.declaredPos.toFixed(4)}% expected=${expected.toFixed(2)} measured=${measured.toFixed(2)} delta=${delta.toFixed(2)}${clamped ? " (clamped)" : ""}`,
    );

    if (element.role === "dot") {
      softCheck(Math.abs(delta) <= 1, `${tag} ${element.name}: dot center is ${delta.toFixed(2)}px off its declared value position (tolerance 1px)`);
    } else if (element.role === "label") {
      softCheck(Math.abs(delta) <= 1, `${tag} ${element.name}: label center is ${delta.toFixed(2)}px off the clamped value-scale center (tolerance 1px)`);
      if (!clamped && element.dotCenterX !== null) {
        const dotDelta = measured - element.dotCenterX;
        softCheck(Math.abs(dotDelta) <= 2, `${tag} ${element.name}: label center is ${dotDelta.toFixed(2)}px off its dot center (tolerance 2px)`);
      }
    } else {
      softCheck(
        Math.abs(delta) <= (clamped ? 1 : 4),
        `${tag} ${element.name}: caption center is ${delta.toFixed(2)}px off its ${clamped ? "clamped" : "value-scale"} center (tolerance ${clamped ? 1 : 4}px)`,
      );
    }

    const overflow = containmentOverflow(element.rect, snapshot.card);
    softCheck(overflow <= 0.5, `${tag} ${element.name}: escapes .valuation-band by ${overflow.toFixed(2)}px (containment 0.5px)`);
  }

  // Full text-box collision oracle: every pair among the median label, ask
  // label and captions must be disjoint. This is stricter than the text-node
  // range check below and catches the label line box itself overlapping.
  const textBoxes = snapshot.elements.filter((element) => element.role === "label" || element.role === "caption");
  for (let i = 0; i < textBoxes.length; i += 1) {
    for (let j = i + 1; j < textBoxes.length; j += 1) {
      const area = intersectionArea(textBoxes[i].rect, textBoxes[j].rect);
      softCheck(area < 0.5, `${tag}: text boxes ${textBoxes[i].name}/${textBoxes[j].name} intersect by ${area.toFixed(2)}px²`);
      rows.push({ state: tag, element: `${textBoxes[i].name}/${textBoxes[j].name}`, oracle: "layout", expectedPx: 0, measuredPx: round(area), deltaPx: null, note: "text-box intersection px²" });
    }
  }

  const captionRects = snapshot.elements.filter((element) => element.role === "caption");
  if (state.minCaptionRows) {
    const rowCount = new Set(captionRects.map((caption) => Math.round(caption.rect.y))).size;
    softCheck(rowCount >= state.minCaptionRows, `${tag}: captions wrapped into ${rowCount} row(s); expected at least ${state.minCaptionRows} (captions are not on the wrapped value scale)`);
    rows.push({ state: tag, element: "caption-rows", oracle: "layout", expectedPx: state.minCaptionRows, measuredPx: rowCount, deltaPx: null, note: "row count" });
  }

  if (snapshot.medianText && snapshot.askTagText) {
    const area = intersectionArea(snapshot.medianText, snapshot.askTagText);
    softCheck(area < 0.5, `${tag}: median value text and ask label text intersect by ${area.toFixed(2)}px²`);
    rows.push({ state: tag, element: "label-text", oracle: "layout", expectedPx: 0, measuredPx: round(area), deltaPx: null, note: "text-range intersection" });
  } else {
    softCheck(false, `${tag}: label text ranges missing (median value or ask tag)`);
  }

  if (state.gapPp !== undefined) {
    const medianDot = snapshot.elements.find((element) => element.name === "median-dot");
    const askDot = snapshot.elements.find((element) => element.name === "ask-dot");
    if (medianDot?.declaredPos !== null && askDot?.declaredPos !== null) {
      const gapPp = Math.abs((askDot?.declaredPos ?? 0) - (medianDot?.declaredPos ?? 0));
      softCheck(Math.abs(gapPp - state.gapPp) <= 0.05, `${tag}: declared ask/median gap is ${gapPp.toFixed(4)}pp, expected ${state.gapPp}pp (pinned ${state.fields.ask} ask)`);
      rows.push({ state: tag, element: "declared-gap", oracle: "pinned-scale", expectedPx: state.gapPp, measuredPx: round(gapPp), deltaPx: round(gapPp - state.gapPp), note: "percentage points" });
    }
  }

  if (state.edge) {
    const askDot = snapshot.elements.find((element) => element.name === "ask-dot");
    const expectedPos = state.edge === "left" ? 2.5 : 97.5;
    softCheck(
      askDot?.declaredPos !== null && Math.abs((askDot?.declaredPos ?? Number.NaN) - expectedPos) < 0.01,
      `${tag}: ask dot declares ${expectedPos}% (measured ${askDot?.declaredPos ?? "missing"})`,
    );
  }

  // Static absolute pins: both the declared percent and the rendered center
  // are checked against constants, so a mutated mapping cannot pass by being
  // internally consistent.
  for (const [name, pinPct] of Object.entries(ABSOLUTE_PINS[state.slug] ?? {})) {
    const element = snapshot.elements.find((candidate) => candidate.name === name);
    if (!element) {
      softCheck(false, `${tag} pin:${name}: pinned element missing from the snapshot`);
      continue;
    }
    softCheck(
      element.declaredPos !== null && Math.abs(element.declaredPos - pinPct) <= 0.01,
      `${tag} pin:${name}: declared ${element.declaredPos ?? "none"}% is not the pinned ${pinPct}%`,
    );
    const desired = snapshot.band.x + (snapshot.band.width * pinPct) / 100;
    const expected = clampCenter(desired, element.rect.width, snapshot.card);
    const delta = element.rect.centerX - expected;
    softCheck(
      Math.abs(delta) <= 1,
      `${tag} pin:${name}: rendered center is ${delta.toFixed(2)}px off the static ${pinPct}% value position (tolerance 1px)`,
    );
    rows.push({ state: tag, element: `pin:${name}`, oracle: "static-pin", expectedPx: round(expected), measuredPx: round(element.rect.centerX), deltaPx: round(delta), note: `pinned=${pinPct}%` });
  }

  const measurementPath = testInfo.outputPath(`band-measurements-${state.slug}-${viewport.width}x${viewport.height}.json`);
  mkdirSync(dirname(measurementPath), { recursive: true });
  writeFileSync(measurementPath, JSON.stringify(rows, null, 2));
  await testInfo.attach(`band-measurements-${state.slug}-${viewport.width}x${viewport.height}.json`, {
    body: JSON.stringify(rows, null, 2),
    contentType: "application/json",
  });

  expect(problems, `${tag} band alignment problems:\n${problems.join("\n") || "none"}`).toEqual([]);
}

for (const state of STATES) {
  test(`band alignment: ${state.slug} — ${state.label}`, async ({ page }, testInfo: TestInfo) => {
    const viewport = testInfo.project.name === DESKTOP_PROJECT ? DESKTOP_VIEWPORT : MOBILE_VIEWPORT;
    await page.setViewportSize(viewport);
    await runBandState(page, testInfo, state, viewport);
  });

  if (state.narrow) {
    test(`band alignment @${NARROW_VIEWPORT.width}x${NARROW_VIEWPORT.height}: ${state.slug} — ${state.label}`, async ({ page }, testInfo: TestInfo) => {
      test.skip(testInfo.project.name !== "mobile-chrome", "320x568 narrow-tier coverage runs once from the mobile project");
      await page.setViewportSize(NARROW_VIEWPORT);
      await runBandState(page, testInfo, state, NARROW_VIEWPORT);
    });
  }
}
