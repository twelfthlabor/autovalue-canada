import { expect, test } from "@playwright/test";
import modelMetrics from "../../public/data/model-metrics.json";

test("default price check is complete and evidence-labelled", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/AutoValue Canada/);
  await expect(page.getByRole("heading", { name: /See the market behind/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "2021 Toyota RAV4" })).toBeVisible();
  await expect(page.getByText("CONDITION-AWARE ML MARKET VALUE", { exact: true })).toBeVisible();
  await expect(page.getByTestId("ml-estimate")).toBeVisible();
  await expect(page.getByText(/204 vehicles/).first()).toBeVisible();
  await expect(page.getByText(/This is an ML estimate, not an observable/)).toBeVisible();
  await expect(page.getByText(/91,278 completed auction outcomes/)).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  if (testInfo.project.name === "chromium-desktop") {
    const workbench = await page.locator(".workbench").boundingBox();
    expect(workbench).not.toBeNull();
    expect(workbench!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    const resultFit = await page.locator(".result-panel").evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
    expect(resultFit.scrollHeight).toBeLessThanOrEqual(resultFit.clientHeight + 1);
  }

  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true });
});

test("vehicle controls cascade to a supported market cell", async ({ page }) => {
  await page.goto("/#check");
  await expect(page.getByRole("heading", { name: "2021 Toyota RAV4" })).toBeVisible();
  await page.getByLabel("Model", { exact: true }).selectOption("Camry");
  await expect(page.getByRole("heading", { name: /Toyota Camry/ })).toBeVisible();
});

test("inspection conditions run through the trained model and change the prediction", async ({ page }) => {
  await page.goto("/#check");
  const initial = await page.getByTestId("ml-estimate").textContent();
  await page.getByLabel("Overall condition grade").selectOption("rough");
  await page.getByLabel("Accident and title history").selectOption("major");
  await page.getByLabel("Mechanical condition").selectOption("major-repair");
  const adjusted = await page.getByTestId("ml-estimate").textContent();
  expect(adjusted).not.toBe(initial);
  const dollars = (value: string | null) => Number(value?.replace(/[^0-9]/g, ""));
  expect(dollars(adjusted)).toBeLessThan(dollars(initial));
  await expect(page.getByText(/Auction-grade equivalent -0.75 \/ 4/)).toBeVisible();
});

test("out-of-support odometer surfaces the capped-mileage caveat on both the signal and the odometer factor", async ({ page }) => {
  await page.goto("/#check");
  await page.getByLabel("Odometer in kilometres").fill("400000");
  await expect(page.locator(".signal-line small")).toHaveText("Outside trained mileage support");
  await expect(page.locator(".stat-foot b[title]")).toHaveAttribute("title", /mileage comparison was capped/);
  await expect(page.locator(".factor-grid article:nth-child(3) strong[title]")).toHaveAttribute("title", /mileage comparison was capped/);
});

test("level-only out-of-support odometer copy says no mileage comparison was applied", async ({ page }) => {
  await page.goto("/#check");
  await page.getByLabel("Province").selectOption("AB");
  await page.getByLabel("Make").selectOption("Buick");
  await page.getByLabel("Model", { exact: true }).selectOption("Encore GX");
  await page.getByLabel("Model year").selectOption("2026");
  await page.getByLabel("Odometer in kilometres").fill("");

  const odometerFactor = page.locator(".factor-grid article").nth(2);
  await expect(odometerFactor.locator("strong")).toHaveText("Market median used");
  await expect(odometerFactor.locator("strong")).toHaveAttribute("title", /no mileage comparison was applied/);
  await expect(page.locator(".ask-tile .stat-foot b[title]")).toHaveAttribute("title", /no mileage comparison was applied/);
  await expect(page.locator(".ask-tile .stat-foot b[title]")).not.toHaveAttribute("title", /capped/);
  await expect(page.locator(".signal-line small")).toHaveText("Outside trained mileage support");
});

test("VIN lookup stays focused and the result remains a single valuation sheet", async ({ page }) => {
  await page.goto("/#check");
  await page.getByLabel("Vehicle identification number").fill("2T3DWRFV3LW077677");
  await expect(page.getByText("17-character check digit verified", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("What does the listing or history report disclose?")).toHaveCount(0);
  await expect(page.getByText("DAMAGE & HISTORY SCREEN")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Check this price/ })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
});

test("supplied VIN decodes live without inventing listing facts", async ({ page }, testInfo) => {
  await page.route("**/api/vin-decode", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      vehicle: { vin: "WAUFAAF43PN018218", year: 2023, make: "Audi", model: "A4", trim: "S Line quattro Prestige", bodyClass: "Sedan/Saloon", driveType: "AWD/All-Wheel Drive", transmission: "Automatic", cylinders: 4, displacementL: 2, fuelType: "Gasoline", plantCountry: "Germany", source: "NHTSA vPIC" },
      notice: "Vehicle decoded live through the official NHTSA vPIC service. Asking price, odometer and listing condition are not encoded in a VIN; enter them manually or connect a licensed inventory feed.",
    }) });
  });

  await page.goto("/#check");
  await page.getByLabel("Vehicle identification number").fill("WAUFAAF43PN018218");
  await page.getByRole("button", { name: "DECODE VIN" }).click();
  await expect(page.getByRole("heading", { name: /2023 Audi A4/ })).toBeVisible();
  await expect(page.getByText(/Vehicle decoded live; no listing feed connected/)).toBeVisible();
  await expect(page.getByText(/VINs do not carry current asking price or odometer/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("vin-live-report.png"), fullPage: true });

  await expect(page.getByRole("heading", { name: /What this value knows/ })).toBeVisible();
  await expect(page.getByText("CONDITION-AWARE ML MARKET VALUE", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Check this price/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("one-page-valuation.png"), fullPage: true });
});

test("asking-price marker has reserved space and does not overlap its caption", async ({ page }) => {
  await page.goto("/#check");
  // The band is client-measured: wait for fonts, the caption layout pass (the
  // inline height is written by the band's useLayoutEffect) and a stable scroll
  // position, so no hydration reflow or fragment scroll settles mid-test.
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForFunction(() => {
    const caption = document.querySelector<HTMLElement>(".band-caption");
    return !!caption && caption.style.height.trim() !== "";
  });
  await page.evaluate(() => new Promise<void>((resolve) => {
    let lastScrollY = window.scrollY;
    let stableFrames = 0;
    let frames = 0;
    const tick = () => {
      frames += 1;
      if (window.scrollY === lastScrollY) stableFrames += 1;
      else { lastScrollY = window.scrollY; stableFrames = 0; }
      if (stableFrames >= 2 || frames >= 90) { resolve(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  // Both boxes must come from ONE layout snapshot: two roundtrips can read
  // across an interleaved reflow/scroll and compare boxes from different
  // layouts. Throwing on missing nodes keeps the assertion from passing
  // vacuously.
  const { captionBottom, markerY } = await page.evaluate(() => {
    const captions = Array.from(document.querySelectorAll<HTMLElement>(".band-caption span"));
    const marker = document.querySelector<HTMLElement>(".band-asking i");
    if (captions.length === 0) throw new Error("caption row not found");
    if (!marker) throw new Error("ask-callout marker not found");
    return {
      captionBottom: Math.max(...captions.map((caption) => caption.getBoundingClientRect().bottom)),
      markerY: marker.getBoundingClientRect().y,
    };
  });
  expect(markerY).toBeGreaterThanOrEqual(captionBottom);
});

test("methodology and control-room evidence are public", async ({ page }, testInfo) => {
  await page.goto("/methodology");
  await expect(page.getByRole("heading", { name: "Claim boundary" })).toBeVisible();
  await expect(page.getByText("BLOCKED", { exact: true }).first()).toBeVisible();

  await page.goto("/market-lab");
  await expect(page.getByRole("heading", { name: "All release gates passed" })).toBeVisible();
  await expect(page.getByText("VERIFIED")).toBeVisible();
  await expect(page.getByText("5,605")).toBeVisible();
  // CI retrains this research benchmark before building the page.
  await expect(page.locator(".model-card.research .scoreboard article").nth(1).locator("strong"))
    .toHaveText(`−${modelMetrics.maeImprovementVsBaselinePct.toFixed(1)}%`);
  await expect(page.getByText(/Zero make-model overlap/)).toBeVisible();

  await page.goto("/calculation");
  await expect(page.getByRole("heading", { name: /Here is the price/ })).toBeVisible();
  await expect(page.getByText("LIVE DATA CONTRACT", { exact: true })).toBeVisible();
  await expect(page.getByText(/NO EMBEDDED LISTINGS/i)).toBeVisible();
  await expect(page.getByText("The app never treats a seller snapshot as live.")).toBeVisible();
  const navLabels = await page.locator(".site-header nav a").allTextContents();
  expect(navLabels.slice(-2)).toEqual(["Methodology", "How we calculate"]);
  await page.screenshot({ path: testInfo.outputPath("calculation-page.png"), fullPage: true });
});
