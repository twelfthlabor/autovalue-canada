import { expect, test, type Page } from "@playwright/test";

type RevealSample = { classed: boolean; opacity: number; translateY: number };

declare global {
  interface Window { firstRevealFrame?: RevealSample | null }
}

const FULL_PAYLOAD = {
  ok: true,
  fields: { province: "BC", make: "Honda", model: "Civic", year: "2022", odometer: "42000", askingPrice: "24900" },
  note: "Year, make, model, odometer, asking price, province in structured data.",
};

// Real 1990 Cadillac Fleetwood offer: no Cadillac Fleetwood cell exists at all,
// so the result panel must fall back to the coverage statement.
const CADILLAC_COVERAGE = {
  ok: true,
  fields: { province: "ON", make: "Cadillac", model: "Fleetwood", year: "1990", odometer: "65481", askingPrice: "25888" },
  note: "Year in page text; make, model, odometer, asking price, province in structured data.",
};

// Real 2014 Chevrolet Corvette offer in AB: Corvette cells exist (2019+), so
// the result panel must rank the closest published cells instead.
const CORVETTE_NEAREST = {
  ok: true,
  fields: { province: "AB", make: "Chevrolet", model: "Corvette", year: "2014", odometer: "99963", askingPrice: "47910" },
  note: "Year in page text; make, model, odometer, asking price, province in structured data.",
};

async function mockImport(page: Page, status: number, payload: unknown) {
  await page.route("**/api/listing-import", (route) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) }));
}

async function importListing(page: Page) {
  await page.goto("/#check");
  // The estimate only renders after hydration and the market fetch; waiting for
  // it keeps the fill and click from landing before React owns the form.
  await expect(page.getByTestId("ml-estimate")).toHaveText("$31,000");
  await page.getByLabel("Listing URL").fill("https://www.autotrader.ca/a/honda/civic/2022");
  await page.getByRole("button", { name: "Import listing" }).click();
}

// The reveal runs as a one-shot 420 ms animation; wait for the element's own
// at-rest state instead of a fixed delay. The workbench also keeps a finished
// fill:both pulse on another element, so a document-wide getAnimations() drain
// never happens. Half a pixel of tolerance absorbs the sub-pixel value anime
// commits as it tears the animation down; a running reveal is far above that.
async function settleReveal(page: Page) {
  await page.waitForFunction(() => {
    const element = document.querySelector<HTMLElement>(".decoded-mini");
    if (!element) return false;
    const style = getComputedStyle(element);
    if (style.opacity !== "1") return false;
    const settled = style.transform === "none" ||
      (() => { const matrix = new DOMMatrixReadOnly(style.transform); return matrix.m11 === 1 && matrix.m22 === 1 && Math.abs(matrix.m41) < 0.5 && Math.abs(matrix.m42) < 0.5; })();
    return settled && element.getAnimations().length === 0;
  });
}

test("a listing URL fills every parsed field and shows its source", async ({ page }, testInfo) => {
  await mockImport(page, 200, FULL_PAYLOAD);
  await importListing(page);

  await expect(page.getByLabel("Province")).toHaveValue("BC");
  await expect(page.getByLabel("Make")).toHaveValue("Honda");
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("Civic");
  await expect(page.getByLabel("Model year")).toHaveValue("2022");
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("42000");
  await expect(page.getByLabel("Asking price in Canadian dollars")).toHaveValue("24900");
  await expect(page.getByText(/Year, make, model, odometer, asking price, province in structured data/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "2022 Honda Civic" })).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("listing-import-success.png"), fullPage: true });
});

test("a partial parse leaves untouched fields alone", async ({ page }) => {
  await mockImport(page, 200, {
    ok: true,
    fields: { make: "Toyota", model: "RAV4", year: "2021" },
    note: "Year, make, model in page metadata.",
  });
  await page.goto("/#check");
  // Wait for hydration and the market fetch before touching the form (WebKit
  // runs the interaction too early otherwise).
  await expect(page.getByTestId("ml-estimate")).toHaveText("$31,000");
  await page.getByLabel("Province").selectOption("BC");
  await page.getByLabel("Odometer in kilometres").fill("12345");
  await page.getByLabel("Asking price in Canadian dollars").fill("9999");
  await page.getByLabel("Listing URL").fill("https://www.kijiji.ca/v-cars-trucks/ottawa/2021-toyota-rav4");
  await page.getByRole("button", { name: "Import listing" }).click();

  await expect(page.getByLabel("Province")).toHaveValue("BC");
  await expect(page.getByLabel("Make")).toHaveValue("Toyota");
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("RAV4");
  await expect(page.getByLabel("Model year")).toHaveValue("2021");
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("12345");
  await expect(page.getByLabel("Asking price in Canadian dollars")).toHaveValue("9999");
});

test("malformed field values from the import response are ignored", async ({ page }) => {
  await mockImport(page, 200, {
    ok: true,
    fields: { province: "BC", make: "Honda", model: "Civic", year: "2022", odometer: "12.5", askingPrice: "not-a-price" },
    note: "Year, make, model, province in structured data.",
  });
  await importListing(page);

  await expect(page.getByLabel("Province")).toHaveValue("BC");
  await expect(page.getByLabel("Make")).toHaveValue("Honda");
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("Civic");
  await expect(page.getByLabel("Model year")).toHaveValue("2022");
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("89000");
  await expect(page.getByLabel("Asking price in Canadian dollars")).toHaveValue("31995");
});

test("a blocked fetch keeps manual entry and shows one short message", async ({ page }) => {
  await mockImport(page, 502, { ok: false, reason: "The listing site blocked the request (403). Enter the details manually." });
  await page.goto("/#check");
  await expect(page.getByTestId("ml-estimate")).toHaveText("$31,000");
  await page.getByLabel("Odometer in kilometres").fill("51234");
  await page.getByLabel("Asking price in Canadian dollars").fill("21000");
  await page.getByLabel("Listing URL").fill("https://www.clutch.ca/listing/12345");
  await page.getByRole("button", { name: "Import listing" }).click();

  await expect(page.getByText("The listing site blocked the request (403). Enter the details manually.")).toBeVisible();
  await expect(page.getByLabel("Province")).toHaveValue("ON");
  await expect(page.getByLabel("Make")).toHaveValue("Toyota");
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("RAV4");
  await expect(page.getByLabel("Model year")).toHaveValue("2021");
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("51234");
  await expect(page.getByLabel("Asking price in Canadian dollars")).toHaveValue("21000");
  await expect(page.getByText(/Year, make, model, odometer/)).toHaveCount(0);
});

test("forced reduced motion fills fields without animation and stays editable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockImport(page, 200, FULL_PAYLOAD);
  await importListing(page);

  await expect(page.getByText(/Year, make, model, odometer, asking price, province/)).toBeVisible();
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("42000");
  const reveal = await page.evaluate(() => {
    const element = document.querySelector<HTMLElement>(".decoded-mini")!;
    const style = getComputedStyle(element);
    return { opacity: style.opacity, transform: style.transform, animations: element.getAnimations().length };
  });
  expect(reveal.opacity).toBe("1");
  expect(reveal.transform).toBe("none");
  expect(reveal.animations).toBe(0);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);

  await page.getByLabel("Odometer in kilometres").fill("55555");
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("55555");
});

for (const [width, height] of [[1440, 900], [1280, 800], [768, 1024], [390, 844], [320, 568]]) {
  test(`the import field, its button and the feedback stay inside the panel clip at ${width}x${height}`, async ({ page }) => {
    const tag = `${width}x${height}`;
    await mockImport(page, 200, FULL_PAYLOAD);
    await page.setViewportSize({ width, height });
    await page.goto("/#check");
    await expect(page.getByTestId("ml-estimate")).toHaveText("$31,000");

    const atRest = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>(".editor-panel:not([hidden])")!;
      panel.scrollTop = 0;
      const panelRect = panel.getBoundingClientRect();
      const inPanel = (el: Element) => { const rect = el.getBoundingClientRect(); return rect.top >= panelRect.top - 0.5 && rect.bottom <= panelRect.bottom + 0.5; };
      const inViewport = (el: Element) => { const rect = el.getBoundingClientRect(); return rect.top >= -0.5 && rect.bottom <= window.innerHeight + 0.5; };
      const input = document.querySelector<HTMLElement>('input[aria-label="Listing URL"]')!;
      const button = Array.from(document.querySelectorAll<HTMLElement>("button")).find((candidate) => candidate.textContent?.includes("Import listing"))!;
      const hint = document.querySelector<HTMLElement>(".history-input .kicker span")!;
      const inputRect = input.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const hintRect = hint.getBoundingClientRect();
      const overlap = (a: DOMRect, b: DOMRect) =>
        Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const inputStyle = getComputedStyle(input);
      return {
        scrollTop: panel.scrollTop,
        scrollOverflow: panel.scrollHeight - panel.clientHeight,
        inputInPanel: inPanel(input), inputInViewport: inViewport(input),
        buttonInPanel: inPanel(button), buttonInViewport: inViewport(button),
        inputContentWidth: inputRect.width - parseFloat(inputStyle.paddingLeft) - parseFloat(inputStyle.paddingRight) - parseFloat(inputStyle.borderLeftWidth) - parseFloat(inputStyle.borderRightWidth),
        inputButtonIntersection: overlap(inputRect, buttonRect),
        hintOverlapsField: overlap(hintRect, inputRect) > 0 || overlap(hintRect, buttonRect) > 0,
      };
    });
    expect(atRest.scrollTop, `${tag} panel scroll`).toBe(0);
    expect(atRest.scrollOverflow, `${tag} panel content overflow`).toBeLessThanOrEqual(1);
    expect(atRest.inputInPanel, `${tag} input inside the panel clip`).toBe(true);
    expect(atRest.buttonInPanel, `${tag} button inside the panel clip`).toBe(true);
    expect(atRest.inputInViewport && atRest.buttonInViewport, `${tag} field visible in the viewport`).toBe(true);
    expect(atRest.inputButtonIntersection, `${tag} input and button do not overlap`).toBe(0);
    expect(atRest.hintOverlapsField, `${tag} hint stays clear of the field`).toBe(false);
    if (width === 1280 || width === 390) {
      expect(atRest.inputContentWidth, `${tag} input content width`).toBeGreaterThan(100);
    }

    // Sample the reveal at DOM insertion. React commits the element before the
    // effect that starts the animation, so this microtask captures the hidden
    // first-paint state the pre-fix markup did not have.
    await page.evaluate(() => {
      window.firstRevealFrame = null;
      const observer = new MutationObserver(() => {
        const element = document.querySelector<HTMLElement>(".decoded-mini");
        if (!element) return;
        const style = getComputedStyle(element);
        const matrix = style.transform === "none" ? null : new DOMMatrixReadOnly(style.transform);
        window.firstRevealFrame = {
          classed: element.classList.contains("listing-reveal"),
          opacity: Number.parseFloat(style.opacity),
          translateY: matrix ? Math.round(matrix.m42 * 100) / 100 : 0,
        };
        observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });

    await page.getByLabel("Listing URL").fill("https://www.autotrader.ca/a/honda/civic/2022");
    await page.getByRole("button", { name: "Import listing" }).click();
    await expect(page.getByText("LISTING DETAILS FOUND")).toBeVisible();
    await expect(page.getByRole("heading", { name: "2022 Honda Civic" })).toBeVisible();

    const firstReveal = await page.evaluate(() => window.firstRevealFrame ?? null);
    expect(firstReveal, `${tag} reveal sampled at insertion`).not.toBeNull();
    expect(firstReveal!.classed, `${tag} reveal carries the hidden class at insertion`).toBe(true);
    expect(firstReveal!.opacity, `${tag} reveal starts transparent`).toBe(0);
    expect(firstReveal!.translateY, `${tag} reveal starts offset`).toBe(-6);

    await settleReveal(page);
    const feedback = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>(".editor-panel:not([hidden])")!;
      const element = document.querySelector<HTMLElement>(".decoded-mini")!;
      const panelRect = panel.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      const visible = Math.max(0, Math.min(rect.bottom, panelRect.bottom) - Math.max(rect.top, panelRect.top));
      const style = getComputedStyle(element);
      const matrix = style.transform === "none" ? null : new DOMMatrixReadOnly(style.transform);
      return {
        visible, height: rect.height, inViewport: rect.bottom <= window.innerHeight + 0.5, panelScrollTop: panel.scrollTop,
        opacity: style.opacity,
        settledTransform: !matrix || (matrix.m11 === 1 && matrix.m22 === 1 && Math.abs(matrix.m41) < 0.5 && Math.abs(matrix.m42) < 0.5),
      };
    });
    expect(feedback.opacity, `${tag} settled reveal is opaque`).toBe("1");
    expect(feedback.settledTransform, `${tag} settled reveal is not offset`).toBe(true);
    expect(feedback.visible, `${tag} feedback inside the panel clip`).toBeGreaterThanOrEqual(feedback.height - 0.5);
    expect(feedback.inViewport, `${tag} feedback visible in the viewport`).toBe(true);
    expect(feedback.panelScrollTop, `${tag} feedback needs no panel scroll`).toBe(0);
  });
}

// The unmatched import is the tightest case: identity, odometer and asking
// price all change, the note carries a page-text source, and the result panel
// has no cell. It must fit the internal scroller at every reviewed viewport.
for (const [width, height] of [[1440, 900], [1280, 800], [768, 1024], [390, 844], [320, 568]]) {
  test(`an unmatched import applies its fields and keeps its note inside the panel at ${width}x${height}`, async ({ page }) => {
    const tag = `${width}x${height}`;
    await mockImport(page, 200, CADILLAC_COVERAGE);
    await page.setViewportSize({ width, height });
    await page.goto("/#check");
    await expect(page.getByTestId("ml-estimate")).toHaveText("$31,000");

    const inputGap = await page.evaluate(() => {
      const top = (label: string) => document.querySelector<HTMLElement>(`input[aria-label="${label}"]`)!.getBoundingClientRect().top;
      return Math.abs(top("Odometer in kilometres") - top("Asking price in Canadian dollars"));
    });
    expect(inputGap, `${tag} odometer and asking-price input tops`).toBeLessThanOrEqual(1);

    await page.getByLabel("Listing URL").fill("https://www.autotrader.ca/offers/cadillac-fleetwood-2dr-coupe");
    await page.getByRole("button", { name: "Import listing" }).click();
    await expect(page.getByText("LISTING DETAILS FOUND")).toBeVisible();

    await expect(page.getByLabel("Make")).toHaveValue("Cadillac");
    await expect(page.getByLabel("Model", { exact: true })).toHaveValue("Fleetwood");
    await expect(page.getByLabel("Model year")).toHaveValue("1990");
    await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("65481");
    await expect(page.getByLabel("Asking price in Canadian dollars")).toHaveValue("25888");
    await expect(page.getByText("No published price cell matches that combination.")).toBeVisible();
    await expect(page.getByText(/Published data covers model years 2002-2027/)).toBeVisible();

    await settleReveal(page);
    const feedback = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>(".editor-panel:not([hidden])")!;
      const element = document.querySelector<HTMLElement>(".decoded-mini")!;
      const message = element.querySelector<HTMLElement>(".listing-note-line")!;
      const panelRect = panel.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      return {
        visible: Math.max(0, Math.min(rect.bottom, panelRect.bottom) - Math.max(rect.top, panelRect.top)),
        height: rect.height,
        lines: Math.round(message.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(message).lineHeight)),
        noteClientHeight: message.clientHeight,
        noteScrollHeight: message.scrollHeight,
        panelScrollTop: panel.scrollTop,
      };
    });
    expect(feedback.lines, `${tag} import note stays within two lines`).toBeLessThanOrEqual(2);
    // At 768 the note is at its tightest; the clamp must not hide a third line.
    if (width === 768) {
      expect(feedback.noteScrollHeight, `${tag} note fits without clamping`).toBeLessThanOrEqual(feedback.noteClientHeight + 1);
    }
    expect(feedback.visible, `${tag} feedback inside the panel clip`).toBeGreaterThanOrEqual(feedback.height - 0.5);
    expect(feedback.panelScrollTop, `${tag} feedback needs no panel scroll`).toBe(0);
  });
}

test("a truncated model token resolves to the published family and keeps the listing numbers", async ({ page }) => {
  await mockImport(page, 200, {
    ok: true,
    fields: { province: "ON", make: "Jeep", model: "Grand", year: "2021", odometer: "50000", askingPrice: "30000" },
    note: "Year, make, model, odometer, asking price in structured data.",
  });
  await importListing(page);

  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("Grand Cherokee");
  await expect(page.getByRole("heading", { name: "2021 Jeep Grand Cherokee" })).toBeVisible();
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("50000");
  await expect(page.getByLabel("Asking price in Canadian dollars")).toHaveValue("30000");
});

test("an unmatched model with other published years shows ranked nearest cells, not an estimate", async ({ page }) => {
  await mockImport(page, 200, CORVETTE_NEAREST);
  await page.goto("/#check");
  await expect(page.getByTestId("ml-estimate")).toHaveText("$31,000");
  await page.getByLabel("Listing URL").fill("https://www.autotrader.ca/offers/chevrolet-corvette-stingray-z51");
  await page.getByRole("button", { name: "Import listing" }).click();

  await expect(page.getByLabel("Make")).toHaveValue("Chevrolet");
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("Corvette");
  await expect(page.getByLabel("Model year")).toHaveValue("2014");
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("99963");
  await expect(page.getByLabel("Asking price in Canadian dollars")).toHaveValue("47910");
  await expect(page.getByTestId("ml-estimate")).toHaveCount(0);
  await expect(page.getByText("No published price cell matches that combination.")).toBeVisible();
  await expect(page.getByText("NEAREST PUBLISHED CELLS")).toBeVisible();
  await expect(page.getByText(/Not an estimate for this vehicle/)).toBeVisible();

  const rows = page.locator(".nearest-cells li");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("AB · 2019");
  await expect(rows.nth(0)).toContainText("10 listings");
  await expect(rows.nth(0)).toContainText("$67,988");
});

test("the imported details block fits a 320px viewport without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mockImport(page, 200, FULL_PAYLOAD);
  await importListing(page);

  await expect(page.getByText(/LISTING DETAILS FOUND/)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
