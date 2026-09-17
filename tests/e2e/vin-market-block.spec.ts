import { expect, test, type Page } from "@playwright/test";

const VIN = "WAUFAAF43PN018218";

async function mockAudiQ3Decode(page: Page) {
  await page.route("**/api/vin-decode", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      vehicle: { vin: VIN, year: 2020, make: "Audi", model: "Q3", trim: "Progressiv quattro", bodyClass: "Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)", driveType: "AWD/All-Wheel Drive", transmission: "Automatic", cylinders: 4, displacementL: 2, fuelType: "Gasoline", plantCountry: "Germany", source: "NHTSA vPIC" },
      notice: "Vehicle decoded live through the official NHTSA vPIC service. Asking price, odometer and listing condition are not encoded in a VIN; enter them manually or connect a licensed inventory feed.",
    }) });
  });
}

async function decodeBlockedAudiQ3(page: Page) {
  await page.goto("/#check");
  await page.getByLabel("Province").selectOption("AB");
  await page.getByRole("tab", { name: "VIN", exact: true }).click();
  await page.getByLabel("Vehicle identification number").fill(VIN);
  await page.getByRole("button", { name: "DECODE VIN" }).click();
  await expect(page.getByText("VIN decoded, but no defensible price match is available.")).toBeVisible();
}

test("a blocked VIN decode is never valued under the decoded heading after a price edit", async ({ page }, testInfo) => {
  await mockAudiQ3Decode(page);
  await decodeBlockedAudiQ3(page);

  const expectNoValuation = async () => {
    await expect(page.locator(".result-panel h3")).toHaveCount(0);
    await expect(page.getByTestId("ml-estimate")).toHaveCount(0);
    await expect(page.getByText("2025 Audi Q3")).toHaveCount(0);
    await expect(page.locator(".decoded-mini strong")).toHaveText("2020 Audi Q3");
  };

  await expectNoValuation();

  await page.getByRole("tab", { name: "Vehicle", exact: true }).click();
  await page.getByLabel("Asking price in Canadian dollars").fill("25000");
  await page.getByRole("button", { name: /Check this price/ }).click();
  await expectNoValuation();

  await page.screenshot({ path: testInfo.outputPath("vin-block-negative.png"), fullPage: true });
});

test("changing the model year abandons the blocked decode and values the chosen row", async ({ page }, testInfo) => {
  await mockAudiQ3Decode(page);
  await decodeBlockedAudiQ3(page);

  await page.getByRole("tab", { name: "Vehicle", exact: true }).click();
  await page.getByLabel("Model year").selectOption("2022");
  await expect(page.getByRole("heading", { name: "2022 Audi Q3" })).toBeVisible();
  await expect(page.getByTestId("ml-estimate")).toBeVisible();
  await expect(page.getByText("VIN decoded, but no defensible price match is available.")).toHaveCount(0);
  await expect(page.locator(".decoded-mini")).toHaveCount(0);

  await page.screenshot({ path: testInfo.outputPath("vin-block-positive.png"), fullPage: true });
});
