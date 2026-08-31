import { expect, test } from "@playwright/test";

const bmwLookup = {
  vehicle: { vin: "WBA8B7C37HA190314", year: 2017, make: "BMW", model: "340i", trim: "xDrive", bodyClass: "Sedan/Saloon", driveType: "AWD/All-Wheel Drive", transmission: "Not encoded", cylinders: 6, displacementL: 3, fuelType: "Gasoline", plantCountry: "Germany", source: "NHTSA vPIC" },
  listing: {
    source: "CarGurus marketplace snapshot", sourceUrl: "https://www.cargurus.ca/Cars/l-Used-2017-BMW-3-Series-340i-xDrive-Sedan-AWD-t69355", listingId: "108558", verifiedAt: "2026-08-31", seller: "Clutch", sellerTrim: "340i xDrive Sedan", marketModel: "3 Series", province: "ON", askingPrice: 34690, previousPrice: 36090, odometerKm: 73677, transmission: "Automatic AWD", fuel: "Gasoline",
    highlights: [{ label: "Safety Certified", attribution: "Carpages seller listing" }, { label: "Price changed across snapshots", attribution: "$36,090 → $35,190 → $34,690 observed" }],
    comparableEvidence: {
      source: "CarGurus public inventory snapshots", sourceUrl: "https://www.cargurus.ca/Cars/l-Used-2017-BMW-3-Series-340i-xDrive-Sedan-AWD-t69355", capturedAt: "2026-08-31", scope: "2017 BMW 340i xDrive Sedan AWD, automatic, Canada; subject listing excluded",
      comparables: [
        { vin: "WBA8B7C34HA190304", askingPrice: 32488, odometerKm: 70000, location: "Mississauga, ON", transmission: "Automatic", observedAt: "2026-08-25" },
        { vin: "WBA8B7C53HK858282", askingPrice: 25888, odometerKm: 158557, location: "Wetaskiwin, AB", transmission: "Automatic", observedAt: "2026-08-31" },
        { vin: "WBA8B7C39HA190041", askingPrice: 20990, odometerKm: 167000, location: "Lower Sackville, NS", transmission: "Automatic", observedAt: "2026-08-31" },
        { vin: "WBA8B7C35HA189968", askingPrice: 24999, odometerKm: 143962, location: "Kitchener, ON", transmission: "Automatic", observedAt: "2026-08-31" },
        { vin: "WBA8B7C35HK858427", askingPrice: 28995, odometerKm: 147537, location: "Cambridge, ON", transmission: "Automatic", observedAt: "2026-08-31" },
        { vin: "WBA8B7C57HK703878", askingPrice: 30690, odometerKm: 108893, location: "Canada", transmission: "Automatic", observedAt: "2026-08-31" },
      ],
    },
  },
  notice: "Exact public listing found in the verified evidence registry.",
};

test("default price check is complete and evidence-labelled", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/AutoValue Canada/);
  await expect(page.getByRole("heading", { name: /See the market behind/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "2021 Toyota RAV4" })).toBeVisible();
  await expect(page.getByText("$30,248")).toBeVisible();
  await expect(page.getByText(/204 vehicles/)).toBeVisible();
  await expect(page.getByText("Dealer asking prices are not completed transactions.")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  if (testInfo.project.name === "chromium-desktop") {
    const workbench = await page.locator(".workbench").boundingBox();
    expect(workbench).not.toBeNull();
    expect(workbench!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  }

  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true });
});

test("vehicle controls cascade to a supported market cell", async ({ page }) => {
  await page.goto("/#check");
  await expect(page.getByRole("heading", { name: "2021 Toyota RAV4" })).toBeVisible();
  await page.getByLabel("Model", { exact: true }).selectOption("Camry");
  await expect(page.getByRole("heading", { name: /Toyota Camry/ })).toBeVisible();
});

test("VIN lookup stays focused without redundant disclosure controls", async ({ page }) => {
  await page.goto("/#check");
  await page.getByLabel("Vehicle identification number").fill("2T3DWRFV3LW077677");
  await expect(page.getByText("17-character check digit verified", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("What does the listing or history report disclose?")).toHaveCount(0);
  await expect(page.getByText("DAMAGE & HISTORY SCREEN")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Check this price/ })).toBeVisible();
});

test("supplied VIN resolves the exact listing and evaluates its price", async ({ page }, testInfo) => {
  await page.route("**/api/vin-decode", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      vehicle: { vin: "WAUFAAF43PN018218", year: 2023, make: "Audi", model: "A4", trim: "S Line quattro Prestige", bodyClass: "Sedan/Saloon", driveType: "AWD/All-Wheel Drive", transmission: "Automatic", cylinders: 4, displacementL: 2, fuelType: "Gasoline", plantCountry: "Germany", source: "NHTSA vPIC" },
      listing: { source: "Clutch", sourceUrl: "https://www.clutch.ca/vehicles/106685", listingId: "106685", verifiedAt: "2026-08-30", sellerTrim: "Technik 45", province: "ON", askingPrice: 32990, previousPrice: 35690, odometerKm: 76243, transmission: "Automatic AWD", fuel: "Gasoline / mild hybrid", highlights: [{ label: "No accidents reported", attribution: "CARFAX summary shown by seller" }, { label: "Single owner reported", attribution: "CARFAX summary shown by seller" }] },
      notice: "Exact public listing found in the verified evidence registry.",
    }) });
  });

  await page.goto("/#check");
  await page.getByLabel("Vehicle identification number").fill("WAUFAAF43PN018218");
  await page.getByRole("button", { name: "DECODE VIN" }).click();
  await expect(page.getByText("EXACT PUBLIC LISTING FOUND", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /2023 Audi A4 Technik 45/ })).toBeVisible();
  await expect(page.getByText("$32,990").first()).toBeVisible();
  await expect(page.getByText("$32,988").first()).toBeVisible();
  await expect(page.getByText("+$2", { exact: true })).toBeVisible();
  await expect(page.getByText("76,243 km", { exact: true }).first()).toBeVisible();
  const historyFontSize = await page.getByText("No accidents reported", { exact: true }).evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(historyFontSize).toBeGreaterThanOrEqual(11);
  await page.screenshot({ path: testInfo.outputPath("vin-listing-report.png"), fullPage: true });

  await page.getByRole("tab", { name: "How we calculate it" }).click();
  await expect(page.getByRole("heading", { name: /From 180,833 vehicles/ })).toBeVisible();
  await expect(page.getByText("Hidden adjustments")).toBeVisible();
  await expect(page.getByRole("button", { name: /Check this price/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("calculation-tab.png"), fullPage: true });
});

test("BMW VIN produces an auditable mileage-adjusted deal signal", async ({ page }, testInfo) => {
  await page.route("**/api/vin-decode", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(bmwLookup) });
  });

  await page.goto("/#check");
  await page.getByLabel("Vehicle identification number").fill("WBA8B7C37HA190314");
  await page.getByRole("button", { name: "DECODE VIN" }).click();
  await expect(page.getByRole("heading", { name: /2017 BMW 340i xDrive Sedan/ })).toBeVisible();
  await expect(page.getByText("Within matched range", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("$33,200", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("+$1,490", { exact: true })).toBeVisible();
  await expect(page.getByText("6 listings", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "2021 Toyota RAV4" })).toHaveCount(0);

  await page.getByRole("tab", { name: "How we calculate it" }).click();
  await expect(page.getByRole("heading", { name: /From matched listings/ })).toBeVisible();
  await expect(page.getByText("The subject listing is excluded from the fit", { exact: false })).toBeVisible();
  await expect(page.locator(".calc-rail article").filter({ hasText: "-$990" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("bmw-matched-result.png"), fullPage: true });

  await page.getByLabel("Make", { exact: true }).selectOption("Toyota");
  await expect(page.getByText("EXACT PUBLIC LISTING FOUND", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Within matched range", { exact: true })).toHaveCount(0);
  await expect(page.getByText("$33,200", { exact: true })).toHaveCount(0);
});

test("asking-price marker has reserved space and does not overlap its caption", async ({ page }) => {
  await page.goto("/#check");
  const captionBottom = await page.locator(".band-caption span").evaluateAll((elements) => Math.max(...elements.map((element) => element.getBoundingClientRect().bottom)));
  const marker = await page.locator(".band-asking i").boundingBox();
  expect(marker).not.toBeNull();
  expect(marker!.y).toBeGreaterThanOrEqual(captionBottom);
});

test("methodology and control-room evidence are public", async ({ page }, testInfo) => {
  await page.goto("/methodology");
  await expect(page.getByRole("heading", { name: "Claim boundary" })).toBeVisible();
  await expect(page.getByText("BLOCKED", { exact: true }).first()).toBeVisible();

  await page.goto("/market-lab");
  await expect(page.getByRole("heading", { name: "All release gates passed" })).toBeVisible();
  await expect(page.getByText("VERIFIED")).toBeVisible();
  await expect(page.getByText("5,605")).toBeVisible();
  await expect(page.getByText("−45.2%")).toBeVisible();
  await expect(page.getByText(/Zero make-model overlap/)).toBeVisible();

  await page.goto("/calculation");
  await expect(page.getByRole("heading", { name: /Here is the price/ })).toBeVisible();
  await expect(page.getByLabel("Interactive asking price")).toBeVisible();
  await expect(page.getByText("$33,200", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Every observation behind the target.")).toBeVisible();
  await page.getByLabel("Interactive asking price").fill("40000");
  await expect(page.getByText("Above matched range", { exact: true })).toBeVisible();
  const navLabels = await page.locator(".site-header nav a").allTextContents();
  expect(navLabels.slice(-2)).toEqual(["Methodology", "How we calculate"]);
  await page.screenshot({ path: testInfo.outputPath("calculation-page.png"), fullPage: true });
});
