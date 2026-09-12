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
 */

const DESKTOP_PROJECT = "chromium-desktop";

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
};

const RAV4: Omit<BandFields, "ask"> = { province: "ON", make: "Toyota", model: "RAV4", year: "2021", odometer: "89000" };
const ACCENT: Omit<BandFields, "ask"> = { province: "ON", make: "Hyundai", model: "Accent", year: "2008", odometer: "150000" };

const STATES: BandState[] = [
  { slug: "close-above", label: "repro: ask 31,995 sits 5.80pp above the median", fields: { ...RAV4, ask: "31995" }, close: true, exact: false },
  { slug: "exact", label: "ask equals the median", fields: { ...RAV4, ask: "31000" }, close: true, exact: true },
  { slug: "close-below", label: "ask 30,500 sits below the median", fields: { ...RAV4, ask: "30500" }, close: true, exact: false },
  { slug: "far-above", label: "ask 39,000 far above the median", fields: { ...RAV4, ask: "39000" }, close: false, exact: false },
  { slug: "far-below", label: "ask 26,500 far below the median", fields: { ...RAV4, ask: "26500" }, close: false, exact: false },
  { slug: "edge-left", label: "ask 20,000 clamps to the 2.5% left edge", fields: { ...RAV4, ask: "20000" }, close: false, exact: false, edge: "left" },
  { slug: "edge-right", label: "ask 45,000 clamps to the 97.5% right edge", fields: { ...RAV4, ask: "45000" }, close: false, exact: false, edge: "right" },
  { slug: "accent-close-wrap", label: "low-price Accent wraps the P10/P25 captions", fields: { ...ACCENT, ask: "4400" }, close: true, exact: false, minCaptionRows: 2 },
  { slug: "accent-two-rows", label: "ask 5,200 keeps two caption rows without .band-close", fields: { ...ACCENT, ask: "5200" }, close: false, exact: false, minCaptionRows: 2 },
];

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

for (const state of STATES) {
  test(`band alignment: ${state.slug} — ${state.label}`, async ({ page }, testInfo: TestInfo) => {
    test.setTimeout(180_000);
    if (testInfo.project.name === DESKTOP_PROJECT) {
      await page.setViewportSize({ width: 1440, height: 900 });
    }

    await applyState(page, state);
    await expect(page.locator(".price-band.band-close"), `${state.slug}: .band-close presence`).toHaveCount(state.close ? 1 : 0);
    await expect(page.locator(".price-band.band-exact"), `${state.slug}: .band-exact presence`).toHaveCount(state.exact ? 1 : 0);

    const snapshot = await snapshotBand(page);
    expect(snapshot, `${state.slug}: band snapshot`).not.toBeNull();
    if (!snapshot) return;

    // Screenshots first so a RED run still shows the displaced layout.
    await page.locator(".valuation-band").screenshot({ path: testInfo.outputPath(`band-${state.slug}-${testInfo.project.name}.png`) });
    await page.screenshot({ path: testInfo.outputPath(`band-full-${testInfo.project.name}.png`), fullPage: true });

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
          ? `${state.slug} ${element.name}: not on value scale (no data-band-pos or inline left)`
          : `${state.slug} ${element.name}: no declared value position (no data-band-pos or inline left)`;
        softCheck(false, message);
        rows.push({ state: state.slug, element: element.name, oracle: null, expectedPx: null, measuredPx: round(measured), deltaPx: null, note: "not on value scale" });
        continue;
      }

      const desired = snapshot.band.x + (snapshot.band.width * element.declaredPos) / 100;
      const expected = clampCenter(desired, element.rect.width, snapshot.card);
      const delta = measured - expected;
      const clamped = Math.abs(expected - desired) > 0.01;

      rows.push({
        state: state.slug,
        element: element.name,
        oracle: element.oracle,
        expectedPx: round(expected),
        measuredPx: round(measured),
        deltaPx: round(delta),
        note: clamped ? "clamped" : "centered",
      });
      console.log(
        `[band-alignment] ${state.slug} ${element.name} pos=${element.declaredPos.toFixed(4)}% expected=${expected.toFixed(2)} measured=${measured.toFixed(2)} delta=${delta.toFixed(2)}${clamped ? " (clamped)" : ""}`,
      );

      if (element.role === "dot") {
        softCheck(Math.abs(delta) <= 1, `${state.slug} ${element.name}: dot center is ${delta.toFixed(2)}px off its declared value position (tolerance 1px)`);
      } else if (element.role === "label") {
        softCheck(Math.abs(delta) <= 1, `${state.slug} ${element.name}: label center is ${delta.toFixed(2)}px off the clamped value-scale center (tolerance 1px)`);
        if (!clamped && element.dotCenterX !== null) {
          const dotDelta = measured - element.dotCenterX;
          softCheck(Math.abs(dotDelta) <= 2, `${state.slug} ${element.name}: label center is ${dotDelta.toFixed(2)}px off its dot center (tolerance 2px)`);
        }
      } else {
        softCheck(
          Math.abs(delta) <= (clamped ? 1 : 4),
          `${state.slug} ${element.name}: caption center is ${delta.toFixed(2)}px off its ${clamped ? "clamped" : "value-scale"} center (tolerance ${clamped ? 1 : 4}px)`,
        );
      }

      const overflow = containmentOverflow(element.rect, snapshot.card);
      softCheck(overflow <= 0.5, `${state.slug} ${element.name}: escapes .valuation-band by ${overflow.toFixed(2)}px (containment 0.5px)`);
    }

    const captionRects = snapshot.elements.filter((element) => element.role === "caption");
    for (let i = 0; i < captionRects.length; i += 1) {
      for (let j = i + 1; j < captionRects.length; j += 1) {
        const area = intersectionArea(captionRects[i].rect, captionRects[j].rect);
        softCheck(area < 0.5, `${state.slug}: caption boxes ${captionRects[i].name}/${captionRects[j].name} intersect by ${area.toFixed(2)}px²`);
      }
    }

    if (state.minCaptionRows) {
      const rowCount = new Set(captionRects.map((caption) => Math.round(caption.rect.y))).size;
      softCheck(rowCount >= state.minCaptionRows, `${state.slug}: captions wrapped into ${rowCount} row(s); expected at least ${state.minCaptionRows} (captions are not on the wrapped value scale)`);
      rows.push({ state: state.slug, element: "caption-rows", oracle: "layout", expectedPx: state.minCaptionRows, measuredPx: rowCount, deltaPx: null, note: "row count" });
    }

    if (snapshot.medianText && snapshot.askTagText) {
      const area = intersectionArea(snapshot.medianText, snapshot.askTagText);
      softCheck(area < 0.5, `${state.slug}: median value text and ask label text intersect by ${area.toFixed(2)}px²`);
      rows.push({ state: state.slug, element: "label-text", oracle: "layout", expectedPx: 0, measuredPx: round(area), deltaPx: null, note: "intersection area" });
    } else {
      softCheck(false, `${state.slug}: label text ranges missing (median value or ask tag)`);
    }

    if (state.edge) {
      const askDot = snapshot.elements.find((element) => element.name === "ask-dot");
      const expectedPos = state.edge === "left" ? 2.5 : 97.5;
      softCheck(
        askDot?.declaredPos !== null && Math.abs((askDot?.declaredPos ?? Number.NaN) - expectedPos) < 0.01,
        `${state.slug}: ask dot declares ${expectedPos}% (measured ${askDot?.declaredPos ?? "missing"})`,
      );
    }

    await testInfo.attach(`band-measurements-${state.slug}-${testInfo.project.name}.json`, {
      body: JSON.stringify(rows, null, 2),
      contentType: "application/json",
    });

    expect(problems, `${state.slug} band alignment problems:\n${problems.join("\n") || "none"}`).toEqual([]);
  });
}
