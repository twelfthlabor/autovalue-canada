import { expect, test } from "@playwright/test";

const VIN = "2T3DWRFV3LW077677";

test("a decoded RAV4 VIN lands on the populated ON/Toyota/RAV4/2020 valuation sheet", async ({ page }, testInfo) => {
  await page.route("**/api/vin-decode", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        vehicle: {
          vin: VIN,
          year: 2020,
          make: "Toyota",
          model: "RAV4",
          trim: "Limited HV",
          bodyClass: "Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)",
          driveType: "4WD/4-Wheel Drive/4x4",
          transmission: "Automatic",
          cylinders: 4,
          displacementL: 2.5,
          fuelType: "Gasoline",
          plantCountry: "United States (USA)",
          source: "NHTSA vPIC",
        },
        notice: "Vehicle decoded live through the official NHTSA vPIC service. Asking price, odometer and listing condition are not encoded in a VIN; enter them manually or connect a licensed inventory feed.",
      }),
    });
  });

  await page.goto("/#check");
  await page.getByLabel("Vehicle identification number").fill(VIN);
  await page.getByRole("button", { name: "DECODE VIN" }).click();

  await expect(page.getByRole("heading", { name: "2020 Toyota RAV4" })).toBeVisible();

  const estimate = page.getByTestId("ml-estimate");
  await expect(estimate).toBeVisible();
  expect((await estimate.textContent()) ?? "").toMatch(/\$[\d,]+/);

  await expect(page.getByText("VIN decoded, but no defensible price match")).toHaveCount(0);
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("RAV4");

  const yearSelect = page.getByLabel("Model year");
  await expect(yearSelect).toHaveValue("2020");
  const options = await yearSelect.locator("option").allTextContents();
  expect(options).toContain("2020");

  await page.screenshot({ path: testInfo.outputPath("rav4-vin-sheet.png"), fullPage: true });
});
