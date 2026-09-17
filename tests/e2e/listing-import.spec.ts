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

test("the imported details block fits a 320px viewport without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mockImport(page, 200, FULL_PAYLOAD);
  await importListing(page);

  await expect(page.getByText(/LISTING DETAILS FOUND/)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
