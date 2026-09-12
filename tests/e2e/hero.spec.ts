import { expect, test } from "@playwright/test";

test("hero visual renders as a decorative card", async ({ page }) => {
  await page.goto("/");
  const visual = page.locator(".hero-visual");
  await expect(visual).toBeVisible();
  await expect(visual).toHaveAttribute("aria-hidden", "true");
  await expect(visual.locator(".hero-card")).toBeVisible();
});

test("hero CTA anchors to the workbench", async ({ page }) => {
  await page.goto("/");
  const cta = page.locator("a.hero-cta[href='#check']");
  await expect(cta).toBeVisible();
  await expect(cta).toContainText(/Check this price/);
});

test("hero ticker shows manifest values", async ({ page }) => {
  await page.goto("/");
  const ticker = page.locator(".hero-ticker");
  await expect(ticker).toBeVisible();
  await expect(ticker.getByText("5,605").first()).toBeVisible();
  await expect(ticker.getByText("180,833").first()).toBeVisible();
});

test("hero introduces no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".hero-visual")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("hero motion opts out under prefers-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const animation = await page.locator(".hero-ticker-track").evaluate((element) => getComputedStyle(element).animationName);
  expect(animation).toBe("none");
});

test("hero keeps the ml-estimate workbench present", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("ml-estimate")).toBeVisible();
});
