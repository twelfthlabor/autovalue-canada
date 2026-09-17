import { expect, test, type Page } from "@playwright/test";

// WebKit supports clipboard-read only; writeText is allowed from the click gesture.
test.beforeEach(async ({ context }, testInfo) => {
  const readOnly = testInfo.project.use.defaultBrowserType === "webkit";
  await context.grantPermissions(readOnly ? ["clipboard-read"] : ["clipboard-read", "clipboard-write"]);
});

const DEFAULT_ESTIMATE = "$31,000";

async function waitForDefaultCheck(page: Page) {
  await page.goto("/#check");
  await expect(page.getByTestId("ml-estimate")).toHaveText(DEFAULT_ESTIMATE);
}

test("saved checks survive a reload and restore the exact scenario", async ({ page }, testInfo) => {
  await waitForDefaultCheck(page);
  const estimate = page.getByTestId("ml-estimate");
  const rows = page.getByTestId("saved-scenario");

  await page.getByRole("button", { name: "Save this check" }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByTestId("saved-estimate")).toHaveText(DEFAULT_ESTIMATE);

  await page.getByLabel("Odometer in kilometres").fill("120000");
  await page.getByLabel("Asking price in Canadian dollars").fill("25000");
  await page.getByRole("tab", { name: "Condition", exact: true }).click();
  await page.getByRole("group", { name: "Condition tier" }).getByRole("button", { name: "Rough" }).click();
  await expect(estimate).not.toHaveText(DEFAULT_ESTIMATE);
  const roughEstimate = (await estimate.innerText()).trim();
  await page.getByRole("button", { name: "Save this check" }).click();
  await expect(rows).toHaveCount(2);

  const roughRow = rows.filter({ hasText: "120,000 km" });
  const defaultRow = rows.filter({ hasText: "89,000 km" });
  await expect(roughRow.getByTestId("saved-estimate")).toHaveText(roughEstimate);
  await expect(defaultRow.getByTestId("saved-estimate")).toHaveText(DEFAULT_ESTIMATE);
  await expect(defaultRow).toContainText("ask $31,995");
  if (testInfo.project.name === "chromium-desktop") {
    await page.screenshot({ path: testInfo.outputPath("scenarios.png"), fullPage: true });
  }

  await page.reload();
  await expect(rows).toHaveCount(2);
  await expect(roughRow.getByTestId("saved-estimate")).toHaveText(roughEstimate);

  await roughRow.getByRole("button", { name: /^Restore / }).click();
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("120000");
  await expect(page.getByLabel("Asking price in Canadian dollars")).toHaveValue("25000");
  await page.getByRole("tab", { name: "Condition", exact: true }).click();
  await expect(page.getByRole("group", { name: "Condition tier" }).getByRole("button", { name: "Rough" })).toHaveAttribute("aria-pressed", "true");
  await expect(estimate).toHaveText(roughEstimate);

  await defaultRow.getByRole("button", { name: /^Delete / }).click();
  await expect(rows).toHaveCount(1);
  await page.reload();
  await expect(rows).toHaveCount(1);
  await expect(defaultRow).toHaveCount(0);
  await expect(roughRow.getByTestId("saved-estimate")).toHaveText(roughEstimate);
});

test("a copied link restores the scenario in a fresh context", async ({ page, browser }) => {
  await waitForDefaultCheck(page);
  await page.getByLabel("Odometer in kilometres").fill("120000");
  await page.getByLabel("Asking price in Canadian dollars").fill("25000");
  const expected = (await page.getByTestId("ml-estimate").innerText()).trim();

  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Link copied" })).toBeVisible();
  const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(shareUrl).toContain("?p=ON");
  expect(shareUrl).toContain("mk=Toyota");
  expect(shareUrl).toContain("km=120000");
  expect(shareUrl).toContain("ask=25000");

  const context = await browser.newContext();
  const fresh = await context.newPage();
  try {
    await fresh.goto(shareUrl);
    await expect(fresh.getByLabel("Province")).toHaveValue("ON");
    await expect(fresh.getByLabel("Make")).toHaveValue("Toyota");
    await expect(fresh.getByLabel("Model", { exact: true })).toHaveValue("RAV4");
    await expect(fresh.getByLabel("Model year")).toHaveValue("2021");
    await expect(fresh.getByLabel("Odometer in kilometres")).toHaveValue("120000");
    await expect(fresh.getByLabel("Asking price in Canadian dollars")).toHaveValue("25000");
    await expect(fresh.getByTestId("ml-estimate")).toHaveText(expected);
  } finally {
    await context.close();
  }
});

test("corrupted saved data is ignored and can be replaced", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("autovalue.scenarios.v1", "{not json"));
  await waitForDefaultCheck(page);
  await expect(page.getByTestId("saved-scenario")).toHaveCount(0);
  await expect(page.getByText("No saved checks yet.")).toBeVisible();

  await page.getByRole("button", { name: "Save this check" }).click();
  await expect(page.getByTestId("saved-scenario")).toHaveCount(1);
});

test("storage that throws leaves saving unavailable without crashing", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new Error("denied"); } }));
  await waitForDefaultCheck(page);

  await page.getByRole("button", { name: "Save this check" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saving is unavailable" })).toBeVisible();
  await expect(page.getByTestId("saved-scenario")).toHaveCount(0);
  await page.getByLabel("Odometer in kilometres").fill("150000");
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("150000");
  expect(pageErrors).toEqual([]);
});

test("a saved check fits a 320px viewport without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await waitForDefaultCheck(page);
  await page.getByRole("button", { name: "Save this check" }).click();
  await expect(page.getByTestId("saved-scenario")).toHaveCount(1);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("reduced motion confirms a save without animating", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await waitForDefaultCheck(page);
  await page.getByRole("button", { name: "Save this check" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await expect(page.getByTestId("saved-scenario")).toHaveCount(1);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test("a malformed share URL leaves the default scenario untouched", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?p=ON&mk=Toyota&md=RAV4&y=2021&km=not-a-number&ask=&c=excellent");
  await expect(page.getByTestId("ml-estimate")).toHaveText(DEFAULT_ESTIMATE);
  await expect(page.getByLabel("Province")).toHaveValue("ON");
  await expect(page.getByLabel("Make")).toHaveValue("Toyota");
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("RAV4");
  await expect(page.getByLabel("Model year")).toHaveValue("2021");
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("89000");
  await expect(page.getByLabel("Asking price in Canadian dollars")).toHaveValue("31995");

  await page.goto("/?s=1&unknown=payload");
  await expect(page.getByTestId("ml-estimate")).toHaveText(DEFAULT_ESTIMATE);
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("89000");
  await page.getByLabel("Odometer in kilometres").fill("150000");
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("150000");

  await page.goto("/?p=ZZ&mk=Toyota&md=RAV4&y=2021");
  await expect(page.getByTestId("ml-estimate")).toHaveText(DEFAULT_ESTIMATE);
  await expect(page.getByLabel("Province")).toHaveValue("ON");
  expect(pageErrors).toEqual([]);
});
