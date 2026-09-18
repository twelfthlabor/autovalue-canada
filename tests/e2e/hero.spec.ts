import { expect, test } from "@playwright/test";
import market from "../../public/data/market.json";

test("mileage explorer updates the actual estimate and odometer together", async ({ page }) => {
  await page.goto("/");
  const estimate = page.getByTestId("ml-estimate");
  await expect(estimate).toBeVisible();
  const initial = await estimate.textContent();
  await page.getByRole("tab", { name: "Mileage", exact: true }).click();
  const slider = page.getByRole("slider", { name: "Explore mileage" });
  await slider.focus();
  await slider.press("End");
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("250000");
  await expect(estimate).not.toHaveText(initial!);
  expect(Number((await estimate.textContent())!.replace(/\D/g, ""))).toBeLessThan(Number(initial!.replace(/\D/g, "")));
  await page.getByRole("button", { name: "Use market median" }).click();
  const row = market.find(row => row.p === "ON" && row.mk === "Toyota" && row.md === "RAV4" && row.y === 2021)!;
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue(String(row.km));
  await expect(page.locator(".curve-slider-label output")).toHaveText(`${row.km.toLocaleString("en-CA")} km`);
});

test("graph drag changes mileage while ordinary hover does not", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Mileage", exact: true }).click();
  const graph = page.locator(".curve-plot svg");
  await expect(graph).toBeVisible();
  await graph.scrollIntoViewIfNeeded();
  const box = (await graph.boundingBox())!;
  await page.mouse.move(box.x + box.width * .8, box.y + box.height / 2);
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("89000");
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .6, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  const km = Number(await page.getByLabel("Odometer in kilometres").inputValue());
  expect(km).toBeGreaterThan(145000);
  expect(km).toBeLessThan(160000);
  await expect(page.locator(".curve-slider-label output")).toHaveText(`${km.toLocaleString("en-CA")} km`);
});

test("regional comparison uses exact vehicle rows and changes the province", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Across Canada" }).click();
  const rows = market.filter(row => row.mk === "Toyota" && row.md === "RAV4" && row.y === 2021);
  await expect(page.locator(".province-list button")).toHaveCount(rows.length);
  const ab = rows.find(row => row.p === "AB")!;
  const option = page.locator(".province-list button").filter({ hasText: "Alberta" });
  await expect(option).toContainText(ab.p50.toLocaleString("en-CA"));
  await option.click();
  await expect(page.getByLabel("Province")).toHaveValue("AB");
  await expect(page.getByRole("heading", { name: "2021 Toyota RAV4" })).toBeVisible();
});

test("price studio introduces no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("ml-estimate")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const field = await page.getByLabel("Asking price in Canadian dollars").boundingBox();
  const editor = await page.locator(".editor-panel:not([hidden])").boundingBox();
  expect(field!.y + field!.height).toBeLessThanOrEqual(editor!.y + editor!.height);
});

test("reduced motion keeps direct input immediate", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("tab", { name: "Mileage", exact: true }).click();
  await expect(page.locator(".curve-line")).toBeVisible();
  expect(await page.locator(".band-median").evaluate(el => getComputedStyle(el).transitionDuration)).toBe("0s");
});

test("a failed market load gives an explicit recovery action", async ({ page }) => {
  await page.route("**/data/market.json", route => route.fulfill({ status: 503, body: "unavailable" }));
  await page.goto("/");
  await expect(page.getByText("The market reference could not load.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload market data" })).toBeVisible();
  await expect(page.getByTestId("ml-estimate")).toHaveCount(0);
});

test("a pinned scenario stays fixed and restores its original inputs", async ({ page }) => {
  await page.goto("/");
  const estimate = page.getByTestId("ml-estimate");
  await expect(estimate).toBeVisible();
  const original = await estimate.textContent();
  await page.getByRole("button", { name: "Add to compare", exact: true }).click();
  await expect(page.getByTestId("pinned-estimate")).toHaveText(original!);
  await page.getByLabel("Odometer in kilometres").fill("190000");
  await expect(estimate).not.toHaveText(original!);
  await expect(page.getByTestId("pinned-estimate")).toHaveText(original!);
  await page.getByRole("button", { name: /Restore inputs/ }).click();
  await expect(page.getByLabel("Odometer in kilometres")).toHaveValue("89000");
  await expect(estimate).toHaveText(original!);
  await expect(page.getByTestId("scenario-delta")).toHaveText("+$0 from pinned");
});

test("asking-price controls change the listing without changing its valuation", async ({ page }) => {
  await page.goto("/");
  const estimate = page.getByTestId("ml-estimate");
  await expect(estimate).toBeVisible();
  const original = await estimate.textContent();
  const slider = page.getByRole("slider", { name: "Explore asking price" });
  await expect(slider).toHaveValue("31995");
  await page.getByRole("button", { name: "Increase asking price by 500 dollars" }).click();
  await expect(page.getByLabel("Asking price in Canadian dollars")).toHaveValue("32495");
  await slider.focus();
  await slider.press("ArrowLeft");
  await expect(page.getByLabel("Asking price in Canadian dollars")).toHaveValue("32494");
  await expect(estimate).toHaveText(original!);
});

test("evidence dialog restores focus and tab navigation works with a keyboard", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Inspect the evidence" });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  const vehicle = page.getByRole("tab", { name: "Vehicle", exact: true });
  await vehicle.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Condition", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("group", { name: "Condition tier" })).toBeVisible();
});

test("the complete workspace fits and is centred at normal laptop zoom", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Desktop viewport contract");
  await page.goto("/");
  await expect(page.getByTestId("ml-estimate")).toBeVisible();
  for (const [width, height] of [[1280, 720], [1366, 768], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    const box = await page.locator(".workbench").boundingBox();
    expect(box!.y).toBeGreaterThan(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    // Centre against the actual containing blocks: scrollbar-gutter and a
    // classic scrollbar shrink the layout width without shrinking clientWidth.
    const studio = await page.locator(".price-studio").boundingBox();
    const body = await page.evaluate(() => { const rect = document.body.getBoundingClientRect(); return { x: rect.x, width: rect.width }; });
    const workbenchLeft = box!.x - studio!.x;
    const workbenchRight = studio!.x + studio!.width - (box!.x + box!.width);
    expect(Math.abs(workbenchLeft - workbenchRight)).toBeLessThanOrEqual(2);
    const studioLeft = studio!.x - body.x;
    const studioRight = body.x + body.width - (studio!.x + studio!.width);
    expect(Math.abs(studioLeft - studioRight)).toBeLessThanOrEqual(2);
    const panel = await page.locator(".price-explorer").evaluate(el => ({ client: el.clientHeight, scroll: el.scrollHeight }));
    expect(panel.scroll).toBeLessThanOrEqual(panel.client + 1);
    expect(await page.evaluate(() => visualViewport!.scale)).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});
