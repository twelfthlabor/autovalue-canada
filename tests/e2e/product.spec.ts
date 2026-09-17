import { expect, test } from "@playwright/test";
import modelMetrics from "../../public/data/model-metrics.json";

test("default price check is complete and evidence-labelled", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/AutoValue Canada/);
  await expect(page.getByRole("heading", { name: /Get a feel for the price/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "2021 Toyota RAV4" })).toBeVisible();
  await expect(page.locator(".ml-tile .stat-label")).toBeVisible();
  await expect(page.getByTestId("ml-estimate")).toBeVisible();
  await expect(page.getByText(/204 vehicles/i).first()).toBeVisible();
  await page.getByRole("button", { name: "Inspect the evidence" }).click();
  await expect(page.getByText(/This is an ML estimate, not an observable/)).toBeVisible();
  await expect(page.getByText(/91,278 completed auction outcomes/)).toBeVisible();

  await page.getByRole("button", { name: "Close evidence" }).click();
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

test("condition tiers run through the trained model and change the prediction", async ({ page }) => {
  await page.goto("/#check");
  const estimate = page.getByTestId("ml-estimate");
  const dollars = (value: string | null) => Number(value?.replace(/[^0-9]/g, ""));
  const initial = await estimate.textContent();
  await page.getByRole("tab", { name: "Condition", exact: true }).click();
  const group = page.getByRole("group", { name: "Condition tier" });
  const tierButtons = group.getByRole("button");
  await expect(tierButtons).toHaveCount(3);

  // Average is the default reference tier at 89,000 km.
  await expect(estimate).toHaveText("$31,000");
  const deltaText = (name: string) => group.getByRole("button", { name }).locator(".tier-delta").evaluate((element) => element.textContent);
  expect(await deltaText("Below average")).toBe("−$8,300 vs avg tier");
  expect(await deltaText("Rough")).toBe("−$2,400 vs avg tier");
  expect(dollars(await deltaText("Below average"))).toBeGreaterThan(dollars(await deltaText("Rough")));
  expect(dollars(await deltaText("Rough"))).toBeGreaterThan(0);
  await expect(group.getByRole("button", { name: "Average or better" }).locator(".tier-delta")).toHaveText("Reference");
  await expect(group.getByRole("button", { name: "Rough" }).locator(".tier-delta")).toHaveAttribute("title", "Difference vs the Average tier at the same mileage");

  // Each tier changes the estimate: average $31,000 > rough $28,600 > below average $22,700.
  await group.getByRole("button", { name: "Rough" }).click();
  await expect(estimate).toHaveText("$28,600");
  const adjusted = await estimate.textContent();
  expect(adjusted).not.toBe(initial);
  expect(dollars(adjusted)).toBeLessThan(dollars(initial));
  await group.getByRole("button", { name: "Below average" }).click();
  await expect(estimate).toHaveText("$22,700");
  expect(dollars(await estimate.textContent())).toBeLessThan(dollars(adjusted));
  await group.getByRole("button", { name: "Average or better" }).click();
  await expect(estimate).toHaveText("$31,000");

  // The evidence dialog still reports the auction-grade equivalent for Rough.
  await group.getByRole("button", { name: "Rough" }).click();
  await expect(estimate).toHaveText("$28,600");
  await page.getByRole("button", { name: "Inspect the evidence" }).click();
  await expect(page.getByText("Auction-grade equivalent 1.00 (scale -1 to 4)", { exact: true })).toBeVisible();
});

test("out-of-support odometer surfaces the capped-mileage caveat on both the signal and the odometer factor", async ({ page }) => {
  await page.goto("/#check");
  await page.getByLabel("Odometer in kilometres").fill("400000");
  await expect(page.locator(".signal-line small")).toHaveText("Outside trained mileage support");
  await expect(page.locator(".stat-foot b[title]")).toHaveAttribute("title", /mileage comparison was capped/);
  await page.getByRole("button", { name: "Inspect the evidence" }).click();
  await expect(page.locator(".factor-grid article:nth-child(3) strong[title]")).toHaveAttribute("title", /mileage comparison was capped/);
});

test("level-only out-of-support odometer copy says no mileage comparison was applied", async ({ page }) => {
  await page.goto("/#check");
  await page.getByLabel("Province").selectOption("AB");
  await page.getByLabel("Make").selectOption("Buick");
  await page.getByLabel("Model", { exact: true }).selectOption("Encore GX");
  await page.getByLabel("Model year").selectOption("2026");
  await page.getByLabel("Odometer in kilometres").fill("");

  await page.getByRole("button", { name: "Inspect the evidence" }).click();
  const odometerFactor = page.locator(".factor-grid article").nth(2);
  await expect(odometerFactor.locator("strong")).toHaveText("Market median used");
  await expect(odometerFactor.locator("strong")).toHaveAttribute("title", /no mileage comparison was applied/);
  await page.getByRole("button", { name: "Close evidence" }).click();
  await expect(page.locator(".ask-tile .stat-foot b[title]")).toHaveAttribute("title", /no mileage comparison was applied/);
  await expect(page.locator(".ask-tile .stat-foot b[title]")).not.toHaveAttribute("title", /capped/);
  await expect(page.locator(".signal-line small")).toHaveText("Outside trained mileage support");
});

test("VIN lookup stays focused and the result remains a single valuation sheet", async ({ page }) => {
  await page.goto("/#check");
  await page.getByRole("tab", { name: "VIN", exact: true }).click();
  await page.getByLabel("Vehicle identification number").fill("2T3DWRFV3LW077677");
  await expect(page.getByText("17-character check digit verified", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("What does the listing or history report disclose?")).toHaveCount(0);
  await expect(page.getByText("DAMAGE & HISTORY SCREEN")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Check this price/ })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(7);
});

test("supplied VIN decodes live without inventing listing facts", async ({ page }, testInfo) => {
  await page.route("**/api/vin-decode", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      vehicle: { vin: "WAUFAAF43PN018218", year: 2023, make: "Audi", model: "A4", trim: "S Line quattro Prestige", bodyClass: "Sedan/Saloon", driveType: "AWD/All-Wheel Drive", transmission: "Automatic", cylinders: 4, displacementL: 2, fuelType: "Gasoline", plantCountry: "Germany", source: "NHTSA vPIC" },
      notice: "Vehicle decoded live through the official NHTSA vPIC service. Asking price, odometer and listing condition are not encoded in a VIN; enter them manually or connect a licensed inventory feed.",
    }) });
  });

  await page.goto("/#check");
  await page.getByRole("tab", { name: "VIN", exact: true }).click();
  await page.getByLabel("Vehicle identification number").fill("WAUFAAF43PN018218");
  await page.getByRole("button", { name: "DECODE VIN" }).click();
  await expect(page.getByRole("heading", { name: /2023 Audi A4/ })).toBeVisible();
  await expect(page.getByText(/Vehicle decoded live; no listing feed connected/)).toBeVisible();
  await expect(page.getByText(/VINs do not carry current asking price or odometer/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("vin-live-report.png"), fullPage: true });

  await page.getByRole("button", { name: "Inspect the evidence" }).click();
  await expect(page.getByRole("heading", { name: /What this value knows/ })).toBeVisible();
  await expect(page.locator(".ml-tile .stat-label")).toBeVisible();
  await page.getByRole("button", { name: "Close evidence" }).click();
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
  await expect(page.getByRole("heading", { name: "How we calculate", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Interactive worked valuation example" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Where inputs come from" })).toBeVisible();
  await expect(page.getByText(/The app never treats a seller snapshot as live/)).toBeVisible();
  const navLabels = await page.locator(".site-header nav a").allTextContents();
  expect(navLabels.slice(-2)).toEqual(["Methodology", "How we calculate"]);
  await page.screenshot({ path: testInfo.outputPath("calculation-page.png"), fullPage: true });
});
