import { expect, test, type Page } from "@playwright/test";

const FULL_PAYLOAD = {
  ok: true,
  fields: { province: "BC", make: "Honda", model: "Civic", year: "2022", odometer: "42000", askingPrice: "24900" },
  note: "Found year, make, model, odometer, asking price and province in structured data.",
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

test("a listing URL fills every parsed field and shows its source", async ({ page }, testInfo) => {
  await mockImport(page, 200, FULL_PAYLOAD);
  await importListing(page);

  await expect(page.getByLabel("Province")).toHaveValue("BC");
  await expect(page.getByLabel("Make")).toHaveValue("Honda");
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("Civic");
  await expect(page.getByLabel("Model year")).toHaveValue("2022");
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("42000");
  await expect(page.getByLabel("Asking price in Canadian dollars")).toHaveValue("24900");
  await expect(page.getByText(/Found year, make, model, odometer, asking price and province in structured data/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "2022 Honda Civic" })).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("listing-import-success.png"), fullPage: true });
});

test("a partial parse leaves untouched fields alone", async ({ page }) => {
  await mockImport(page, 200, {
    ok: true,
    fields: { make: "Toyota", model: "RAV4", year: "2021" },
    note: "Found year, make and model in page metadata.",
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
    note: "Found year, make, model and province in structured data.",
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
  await expect(page.getByText(/Found year, make/)).toHaveCount(0);
});

test("forced reduced motion fills fields without animation and stays editable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockImport(page, 200, FULL_PAYLOAD);
  await importListing(page);

  await expect(page.getByText(/Found year, make, model, odometer, asking price and province/)).toBeVisible();
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("42000");
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
      return {
        scrollTop: panel.scrollTop,
        scrollOverflow: panel.scrollHeight - panel.clientHeight,
        inputInPanel: inPanel(input), inputInViewport: inViewport(input),
        buttonInPanel: inPanel(button), buttonInViewport: inViewport(button),
      };
    });
    expect(atRest.scrollTop, `${tag} panel scroll`).toBe(0);
    expect(atRest.scrollOverflow, `${tag} panel content overflow`).toBeLessThanOrEqual(1);
    expect(atRest.inputInPanel, `${tag} input inside the panel clip`).toBe(true);
    expect(atRest.buttonInPanel, `${tag} button inside the panel clip`).toBe(true);
    expect(atRest.inputInViewport && atRest.buttonInViewport, `${tag} field visible in the viewport`).toBe(true);

    await page.getByLabel("Listing URL").fill("https://www.autotrader.ca/a/honda/civic/2022");
    await page.getByRole("button", { name: "Import listing" }).click();
    await expect(page.getByText("LISTING DETAILS FOUND")).toBeVisible();
    await expect(page.getByRole("heading", { name: "2022 Honda Civic" })).toBeVisible();

    const feedback = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>(".editor-panel:not([hidden])")!;
      const element = document.querySelector<HTMLElement>(".decoded-mini")!;
      const panelRect = panel.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      const visible = Math.max(0, Math.min(rect.bottom, panelRect.bottom) - Math.max(rect.top, panelRect.top));
      return { visible, height: rect.height, inViewport: rect.bottom <= window.innerHeight + 0.5, panelScrollTop: panel.scrollTop };
    });
    expect(feedback.visible, `${tag} feedback inside the panel clip`).toBeGreaterThanOrEqual(feedback.height - 1);
    expect(feedback.inViewport, `${tag} feedback visible in the viewport`).toBe(true);
    expect(feedback.panelScrollTop, `${tag} feedback needs no panel scroll`).toBe(0);
  });
}

test("a truncated model token resolves to the published family and keeps the listing numbers", async ({ page }) => {
  await mockImport(page, 200, {
    ok: true,
    fields: { province: "ON", make: "Jeep", model: "Grand", year: "2021", odometer: "50000", askingPrice: "30000" },
    note: "Found year, make, model, odometer and asking price in structured data.",
  });
  await importListing(page);

  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("Grand Cherokee");
  await expect(page.getByRole("heading", { name: "2021 Jeep Grand Cherokee" })).toBeVisible();
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("50000");
  await expect(page.getByLabel("Asking price in Canadian dollars")).toHaveValue("30000");
});

test("an unmatched vehicle shows its parsed identity, no cell, and keeps the old numbers", async ({ page }) => {
  await mockImport(page, 200, {
    ok: true,
    fields: { province: "ON", make: "Toyota", model: "Avalon", year: "2014", odometer: "50000", askingPrice: "40000" },
    note: "Found year, make, model, odometer and asking price in structured data.",
  });
  await page.goto("/#check");
  await expect(page.getByTestId("ml-estimate")).toHaveText("$31,000");
  await page.getByLabel("Odometer in kilometres").fill("51234");
  await page.getByLabel("Asking price in Canadian dollars").fill("21000");
  await page.getByLabel("Listing URL").fill("https://www.kijiji.ca/v-cars/ottawa/2014-toyota-avalon");
  await page.getByRole("button", { name: "Import listing" }).click();

  await expect(page.getByText(/No published price cell matches 2014 Toyota Avalon/)).toBeVisible();
  await expect(page.getByLabel("Make")).toHaveValue("Toyota");
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("Avalon");
  await expect(page.getByLabel("Model year")).toHaveValue("2014");
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("51234");
  await expect(page.getByLabel("Asking price in Canadian dollars")).toHaveValue("21000");
  await expect(page.getByText("No published price cell matches that combination.")).toBeVisible();
});

test("the imported details block fits a 320px viewport without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mockImport(page, 200, FULL_PAYLOAD);
  await importListing(page);

  await expect(page.getByText(/LISTING DETAILS FOUND/)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
